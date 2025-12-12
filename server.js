const express = require('express');
const path = require('path');
const fs = require('fs');
const snmp = require('net-snmp');
const Database = require('better-sqlite3');
const https = require('https');

// Manually load .env file
const envConfig = {};
try {
  const envFileContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFileContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      envConfig[parts[0].trim()] = parts[1].trim();
    }
  });
} catch (err) {
  console.log('Could not load .env file. Telegram alerts will be disabled.');
}

const TELEGRAM_BOT_TOKEN = envConfig.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = envConfig.TELEGRAM_CHAT_ID;
const DAILY_SUMMARY_HOUR = parseInt(process.env.DAILY_SUMMARY_HOUR || envConfig.DAILY_SUMMARY_HOUR || '8', 10);
const DAILY_SUMMARY_MINUTE = parseInt(process.env.DAILY_SUMMARY_MINUTE || envConfig.DAILY_SUMMARY_MINUTE || '0', 10);

function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    // Silently fail if not configured
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const postData = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = https.request(url, options, (res) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error(`Telegram API request failed with status code: ${res.statusCode}`);
      res.on('data', (chunk) => {
        console.error('Telegram API response:', chunk.toString());
      });
    }
  });

  req.on('error', (e) => {
    console.error(`Problem with Telegram API request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

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
// Generic system name OID (used for auto-naming newly discovered UPSes)
const SYS_NAME_OID = '1.3.6.1.2.1.1.5.0';

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

const getLastHistoryStmt = db.prepare(
  'SELECT battery, load, temperature FROM ups_history WHERE id = ? ORDER BY timestamp DESC LIMIT 1'
);

function recordHistory(entries) {
  const now = Date.now();
  const cutoff = now - UPS_HISTORY_MAX_DAYS * 24 * 60 * 60 * 1000;

  const rowsToInsert = [];

  for (const ups of entries) {
    // We only care about online UPSes
    if (ups.status !== 'online') {
      continue;
    }
      
    const lastEntry = getLastHistoryStmt.get(ups.id);

    const newBattery = typeof ups.battery === 'number' ? ups.battery : null;
    const newLoad = typeof ups.load === 'number' ? ups.load : null;
    const newTemp = typeof ups.temperature === 'number' ? ups.temperature : null;

    let changed = false;
    if (!lastEntry) {
      changed = true; // No previous entry
    } else {
      // Compare with last entry.
      if (
        lastEntry.battery !== newBattery ||
        lastEntry.load !== newLoad ||
        lastEntry.temperature !== newTemp
      ) {
        changed = true;
      }
    }

    if (changed) {
      rowsToInsert.push({
        id: ups.id,
        name: ups.name,
        timestamp: now,
        battery: newBattery,
        load: newLoad,
        temperature: newTemp,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const insertMany = db.transaction((rows) => {
      rows.forEach((row) => insertHistoryStmt.run(row));
    });
    insertMany(rowsToInsert);
    console.log(`Recorded history for ${rowsToInsert.length} changed UPS(es).`);
  }

  // Pruning old data can still happen every time.
  db.prepare('DELETE FROM ups_history WHERE timestamp < ?').run(cutoff);
}

function normalizeSnmpString(value) {
  if (Buffer.isBuffer(value)) return value.toString();
  if (typeof value === 'string') return value;
  return undefined;
}

// Quick SNMP probe to check if an IP has a UPS and fetch its sysName
function probeUps(ip, community = 'public', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const session = snmp.createSession(ip, community, {
      port: 161,
      retries: 1,
      timeout: timeoutMs
    });
    
    // Try reading battery charge (to validate UPS) and sysName (for naming)
    session.get([oids.batteryCharge, SYS_NAME_OID], (error, varbinds) => {
      session.close();
      if (error || !varbinds || varbinds.length === 0) {
        resolve({ isUps: false, sysName: null });
      } else {
        const batteryValue = varbinds[0]?.value;
        const isUps = typeof batteryValue === 'number' && batteryValue >= 0 && batteryValue <= 100;
        const sysName = normalizeSnmpString(varbinds[1]?.value) || null;
        resolve({ isUps, sysName });
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
        .then(result => {
          if (result.isUps) {
            const sysName = result.sysName?.trim();
            // Prefer SNMP sysName; fall back to generated name if missing
            const name = sysName && sysName.length > 0
              ? sysName
              : `UPS-${networkBase.split('.').pop()}-${i}`;
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

app.post('/api/test-alert', (req, res) => {
    try {
        const message = req.body?.message || 'This is a test alert from the UPS Dashboard.';
        sendTelegramAlert(message);
        console.log('Test alert sent via API request.');
        res.json({ success: true, message: 'Test alert sent!' });
    } catch (error) {
        console.error('Failed to send test alert via API:', error);
        res.status(500).json({ success: false, error: 'Failed to send test alert.' });
    }
});

// Manual trigger for daily summary
app.post('/api/daily-summary/test', async (req, res) => {
  try {
    await sendDailySummary('manual-summary');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to run manual daily summary.' });
  }
});

// --- Background polling for history ---
const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let upsLastState = {};

async function pollUpsData() {
  if (!upsConfig.length) {
    return;
  }
  
  try {
    const newUspStates = await Promise.all(upsConfig.map((ups) => queryUps(ups)));

    for (const newUspState of newUspStates) {
        const lastState = upsLastState[newUspState.id];
        if (lastState) {
            if (lastState.status === 'online' && newUspState.status === 'offline') {
                sendTelegramAlert(`🚨 UPS OFFLINE: ${newUspState.name} (${newUspState.ip}) is now offline.`);
            } else if (lastState.status === 'offline' && newUspState.status === 'online') {
                sendTelegramAlert(`✅ UPS ONLINE: ${newUspState.name} (${newUspState.ip}) is back online.`);
            }
        }
        upsLastState[newUspState.id] = newUspState;
    }

    recordHistory(newUspStates);
  } catch (err) {
    console.error('Error during scheduled UPS poll:', err);
  }
}

// --- Daily Telegram summary ---
function msUntilNextTime(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

async function sendDailySummary(runId = 'daily-summary') {
  if (!upsConfig.length) {
    return;
  }

  try {
    const states = await Promise.all(upsConfig.map((ups) => queryUps(ups)));

    const counts = states.reduce(
      (acc, s) => {
        acc.total += 1;
        acc.online += s.status === 'online' ? 1 : 0;
        return acc;
      },
      { total: 0, online: 0 }
    );

    const lines = states.map((s) => {
      const batteryText = typeof s.battery === 'number' ? `${s.battery}%` : 'n/a';
      const loadText = typeof s.load === 'number' ? `${s.load}%` : 'n/a';
      const tempText = typeof s.temperature === 'number' ? `${s.temperature}C` : 'n/a';
      return `${s.name} [${s.status}] — battery ${batteryText}, load ${loadText}, temp ${tempText}`;
    });

    const header = `Daily UPS summary (${new Date().toLocaleDateString()} ${DAILY_SUMMARY_HOUR.toString().padStart(2, '0')}:${DAILY_SUMMARY_MINUTE.toString().padStart(2, '0')})`;
    const message = [header, `Online ${counts.online}/${counts.total}`, ...lines].join('\n');

    sendTelegramAlert(message);
  } catch (err) {
    console.error('Failed to send daily UPS summary', err);
  }
}

function scheduleNextSummary() {
  const delay = msUntilNextTime(DAILY_SUMMARY_HOUR, DAILY_SUMMARY_MINUTE);

  setTimeout(async () => {
    await sendDailySummary();
    scheduleNextSummary();
  }, delay);
}

// Start polling timer
setTimeout(() => {
  pollUpsData().catch(err => console.error('Initial poll failed:', err));
}, 10000); // First run after 10 seconds
setInterval(pollUpsData, POLLING_INTERVAL_MS);
console.log(`History polling enabled: will query UPS data every ${POLLING_INTERVAL_MS / 1000 / 60} minutes.`);

// Start daily summary scheduler (defaults to 09:00 local time unless overridden by env)
scheduleNextSummary();

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