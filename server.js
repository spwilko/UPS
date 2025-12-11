const express = require('express');
const path = require('path');
const fs = require('fs');
const snmp = require('net-snmp');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;

const publicDir = __dirname;
app.use(express.static(publicDir));
app.use(express.json());

// --- Load UPS config (names + IPs) ---
const configPath = path.join(__dirname, 'ups-config.json');
let upsConfig = [];

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    upsConfig = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load ups-config.json. Ensure the file exists and is valid JSON.');
    console.error(err);
    upsConfig = [];
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(upsConfig, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to save ups-config.json', err);
    throw err;
  }
}

// Load config on startup
loadConfig();

// Example OIDs (APC-style, change to match what you tested)
const oids = {
  batteryCharge: '1.3.6.1.2.1.33.1.2.4.0',     // upsBatteryCharge
  inputVoltage: '1.3.6.1.2.1.33.1.3.3.1.3.1',  // upsInputVoltage
  outputLoad:   '1.3.6.1.2.1.33.1.4.4.1.5.1',  // upsOutputPercentLoad
  tempC:        '1.3.6.1.2.1.33.1.2.7.0'       // upsBatteryTemperature
};

// --- SQLite history store (persists on disk, shared between Mac and Pi) ---
const dbPath = path.join(__dirname, 'ups-history.sqlite');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS ups_history (
  id TEXT,
  name TEXT,
  timestamp INTEGER,
  battery REAL,
  load REAL,
  temperature REAL
);

CREATE INDEX IF NOT EXISTS idx_ups_history_ts ON ups_history (timestamp);
CREATE INDEX IF NOT EXISTS idx_ups_history_id_ts ON ups_history (id, timestamp);
`);

const UPS_HISTORY_MAX_DAYS = 7;
const insertHistoryStmt = db.prepare(`
  INSERT INTO ups_history (id, name, timestamp, battery, load, temperature)
  VALUES (@id, @name, @timestamp, @battery, @load, @temperature)
`);

function recordHistory(entries) {
  const now = Date.now();
  const cutoff = now - UPS_HISTORY_MAX_DAYS * 24 * 60 * 60 * 1000;

  const insertMany = db.transaction((rows) => {
    rows.forEach((row) => insertHistoryStmt.run(row));
    db.prepare('DELETE FROM ups_history WHERE timestamp < ?').run(cutoff);
  });

  const rows = entries.map((ups) => ({
    id: ups.id,
    name: ups.name,
    timestamp: now,
    battery: typeof ups.battery === 'number' ? ups.battery : null,
    load: typeof ups.load === 'number' ? ups.load : null,
    temperature: typeof ups.temperature === 'number' ? ups.temperature : null
  }));

  insertMany(rows);
}

// Quick SNMP probe to check if an IP has a UPS (returns true/false)
function probeUps(ip, community = 'public', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const session = snmp.createSession(ip, community, {
      port: 161,
      retries: 1,
      timeout: timeoutMs
    });
    
    // Just try to read battery charge OID - if we get a response, it's a UPS
    session.get([oids.batteryCharge], (error, varbinds) => {
      session.close();
      if (error || !varbinds || varbinds.length === 0) {
        resolve(false);
      } else {
        // Check if we got a valid numeric value (UPS battery should be 0-100)
        const value = varbinds[0]?.value;
        resolve(typeof value === 'number' && value >= 0 && value <= 100);
      }
    });
  });
}

function queryUps(ups) {
  return new Promise((resolve) => {
    const session = snmp.createSession(ups.ip, ups.community || 'public');
    const oidList = Object.values(oids);

    session.get(oidList, (error, varbinds) => {
      if (error) {
        console.error(`SNMP error for ${ups.name} (${ups.ip})`, error);
        session.close();
        return resolve({
          id: ups.id,
          name: ups.name,
          ip: ups.ip,
          status: 'offline',
          battery: null,
          load: null,
          temperature: null,
          runtime: null,
          lastUpdate: new Date().toLocaleTimeString()
        });
      }

      const map = {};
      Object.keys(oids).forEach((key, i) => {
        map[key] = varbinds[i]?.value;
      });

      session.close();

      resolve({
        id: ups.id,
        name: ups.name,
        ip: ups.ip,
        status: 'online', // you can refine this using thresholds later
        battery: map.batteryCharge ?? null,
        load: map.outputLoad ?? null,
        temperature: map.tempC ?? null,
        runtime: 60, // placeholder mins
        lastUpdate: new Date().toLocaleTimeString()
      });
    });
  });
}

app.get('/api/ups', async (req, res) => {
  if (!upsConfig.length) {
    return res.status(500).json({ error: 'No UPS configuration loaded' });
  }

  try {
    const results = await Promise.all(upsConfig.map((ups) => queryUps(ups)));
    // Record history snapshot
    recordHistory(results);
    res.json(results);
  } catch (err) {
    console.error('Error querying UPS list', err);
    res.status(500).json({ error: 'Failed to query UPS list' });
  }
});

// UPS history endpoint: /api/ups/history?range=1|2|7 (days)
app.get('/api/ups/history', (req, res) => {
  const rangeDaysRaw = parseInt(req.query.range, 10);
  const rangeDays = [1, 2, 7].includes(rangeDaysRaw) ? rangeDaysRaw : 1;
  const now = Date.now();
  const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

  try {
    const rows = db
      .prepare(
        `SELECT id, name, timestamp, battery, load, temperature
         FROM ups_history
         WHERE timestamp >= ?
         ORDER BY timestamp ASC`
      )
      .all(cutoff);
    res.json(rows);
  } catch (err) {
    console.error('Error reading UPS history from SQLite', err);
    res.status(500).json({ error: 'Failed to read UPS history' });
  }
});

// Discovery function (extracted so it can be called directly or via API)
async function runDiscovery(community = 'public') {
  const networkBase = '10.40.40';
  const startIp = 2;
  const endIp = 30;
  
  console.log(`Starting UPS discovery on ${networkBase}.${startIp}-${endIp}...`);
  
  const discovered = [];
  const promises = [];
  
  // Scan IP range in parallel (with reasonable concurrency)
  for (let i = startIp; i <= endIp; i++) {
    const ip = `${networkBase}.${i}`;
    
    // Skip if already in config
    if (upsConfig.some(u => u.ip === ip)) {
      continue;
    }
    
    promises.push(
      probeUps(ip, community)
        .then(isUps => {
          if (isUps) {
            // Generate a name based on IP (you can customize this)
            const name = `UPS-${networkBase.split('.').pop()}-${i}`;
            const id = `ups-${i}`;
            
            discovered.push({
              id,
              name,
              ip,
              community
            });
            
            console.log(`✓ Discovered UPS at ${ip} - adding as "${name}"`);
          }
        })
        .catch(() => {
          // Silently ignore probe errors
        })
    );
  }
  
  await Promise.all(promises);
  
  // Add discovered UPSes to config
  if (discovered.length > 0) {
    upsConfig.push(...discovered);
    saveConfig();
    loadConfig(); // Reload to ensure consistency
    console.log(`Discovery complete: added ${discovered.length} new UPS(es)`);
  } else {
    console.log('Discovery complete: no new UPSes found');
  }
  
  return {
    success: true,
    discovered: discovered.length,
    ups: discovered
  };
}

// Network discovery endpoint: scans 10.40.40.2-30 for UPSes and auto-adds to config
app.post('/api/discover', async (req, res) => {
  try {
    const community = req.query.community || 'public';
    const result = await runDiscovery(community);
    res.json(result);
  } catch (err) {
    console.error('Discovery error:', err);
    res.status(500).json({ error: 'Discovery failed', message: err.message });
  }
});

app.post('/api/ups/:id/update', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const ups = upsConfig.find(u => u.id === id);

    if (!ups) {
        return res.status(404).json({ error: 'UPS not found' });
    }

    ups.name = name;
    saveConfig();
    res.json({ success: true, ups });
});

// --- Background polling for history ---
const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function pollUpsData() {
  if (!upsConfig.length) {
    return;
  }
  
  try {
    const results = await Promise.all(upsConfig.map((ups) => queryUps(ups)));
    recordHistory(results);
    console.log(`Successfully polled ${results.length} UPS(es) for history.`);
  } catch (err) {
    console.error('Error during scheduled UPS poll:', err);
  }
}

// Start polling timer
setTimeout(() => {
  pollUpsData().catch(err => console.error('Initial poll failed:', err));
}, 10000); // First run after 10 seconds
setInterval(pollUpsData, POLLING_INTERVAL_MS);
console.log(`History polling enabled: will query UPS data every ${POLLING_INTERVAL_MS / 1000 / 60} minutes.`);

// Auto-discovery: run every hour (optional, can be disabled)
const AUTO_DISCOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Start auto-discovery timer (runs every hour)
if (process.env.AUTO_DISCOVERY !== 'false') {
  setTimeout(() => {
    runDiscovery().catch(err => console.error('Auto-discovery failed:', err));
  }, 5000); // First run after 5 seconds
  setInterval(() => {
    runDiscovery().catch(err => console.error('Auto-discovery failed:', err));
  }, AUTO_DISCOVERY_INTERVAL_MS);
  console.log('Auto-discovery enabled: will scan network every hour');
}

// default to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UPS dashboard running at http://172.16.200.220:${PORT}`);
});