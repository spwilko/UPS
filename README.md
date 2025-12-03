# APC UPS Monitoring System

A comprehensive web-based monitoring dashboard for APC UPS units with NMC3 network cards. Monitor battery levels, load, temperature, and system status across multiple UPS devices via SNMP.

## Features

- 🔋 **Real-time Monitoring**: Live status updates for all UPS units
- 📊 **Interactive Dashboards**: Visual charts and performance timelines
- 🚨 **Alert System**: Automatic alerts for critical conditions (low battery, high temperature, overload)
- 🔍 **Auto-Discovery**: Automatically detects and adds UPSes on your network (10.40.40.2-30)
- 📈 **Historical Data**: SQLite-based history tracking with 1/2/7-day timeline views
- 🎨 **Modern UI**: Beautiful, responsive dashboard with glassmorphism design
- 🔄 **Auto-Refresh**: Configurable automatic data refresh every 30 seconds

## Screenshots

- **Dashboard**: Real-time grid view of all UPS units with status indicators
- **Devices**: Detailed device management and configuration
- **Alerts**: Centralized alert management with severity filtering

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Network access to UPS devices via SNMP
- SNMP community string (default: `public`)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/spwilko/UPS.git
   cd UPS
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure UPS devices**:
   
   Edit `ups-config.json` to add your UPS devices:
   ```json
   [
     {
       "id": "ups-1",
       "name": "Server Room UPS 1",
       "ip": "10.40.40.2",
       "community": "public"
     }
   ]
   ```

   Or use **auto-discovery** (see below).

4. **Start the server**:
   ```bash
   node server.js
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000`

## Configuration

### Manual Configuration

Edit `ups-config.json` to manually add UPS devices:

```json
[
  {
    "id": "unique-id",
    "name": "Display Name",
    "ip": "10.40.40.2",
    "community": "public"
  }
]
```

### Auto-Discovery

The system automatically scans the network range `10.40.40.2-30` for UPS devices:

- **Automatic**: Runs every hour in the background
- **Manual**: Trigger discovery via API:
  ```bash
  curl -X POST http://localhost:3000/api/discover
  ```

Discovered UPSes are automatically added to `ups-config.json` with generated names like `UPS-40-5` for IP `10.40.40.5`.

To disable auto-discovery, set environment variable:
```bash
AUTO_DISCOVERY=false node server.js
```

## API Endpoints

### `GET /api/ups`
Returns current status for all configured UPS devices.

**Response**:
```json
[
  {
    "id": "ups-1",
    "name": "Server Room UPS 1",
    "ip": "10.40.40.2",
    "status": "online",
    "battery": 95,
    "load": 45,
    "temperature": 28,
    "runtime": 60,
    "lastUpdate": "3:45:23 PM"
  }
]
```

### `GET /api/ups/history?range=1|2|7`
Returns historical data for timeline charts.

**Query Parameters**:
- `range`: Number of days (1, 2, or 7)

**Response**:
```json
[
  {
    "id": "ups-1",
    "name": "Server Room UPS 1",
    "timestamp": 1701234567890,
    "battery": 95,
    "load": 45,
    "temperature": 28
  }
]
```

### `POST /api/discover`
Manually trigger network discovery.

**Query Parameters**:
- `community`: SNMP community string (optional, defaults to `public`)

**Response**:
```json
{
  "success": true,
  "discovered": 2,
  "ups": [
    {
      "id": "ups-5",
      "name": "UPS-40-5",
      "ip": "10.40.40.5",
      "community": "public"
    }
  ]
}
```

## SNMP Configuration

The system uses standard UPS MIB OIDs:

- **Battery Charge**: `1.3.6.1.2.1.33.1.2.4.0`
- **Input Voltage**: `1.3.6.1.2.1.33.1.3.3.1.3.1`
- **Output Load**: `1.3.6.1.2.1.33.1.4.4.1.5.1`
- **Temperature**: `1.3.6.1.2.1.33.1.2.7.0`

These are configured in `server.js` and can be adjusted for your specific UPS models.

## Alert Thresholds

Alerts are automatically generated based on:

- **Critical Battery**: ≤ 20%
- **Warning Battery**: 20-40%
- **Critical Load**: ≥ 95%
- **Warning Load**: 80-95%
- **Critical Temperature**: ≥ 45°C
- **Warning Temperature**: 40-45°C
- **Offline**: UPS not responding to SNMP

## Data Storage

Historical data is stored in SQLite (`ups-history.sqlite`):

- **Retention**: 7 days of data
- **Automatic cleanup**: Old data is purged automatically
- **Location**: Project root directory

The database file is excluded from git (see `.gitignore`) to keep it local.

## Deployment

### Mac Development

```bash
npm install
node server.js
```

### Raspberry Pi Production

1. **Clone and install**:
   ```bash
   git clone https://github.com/spwilko/UPS.git
   cd UPS
   npm install
   ```

2. **Run as a service** (using PM2 or systemd):
   
   **PM2**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name ups-monitor
   pm2 save
   pm2 startup
   ```

   **systemd** (create `/etc/systemd/system/ups-monitor.service`):
   ```ini
   [Unit]
   Description=UPS Monitor
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/UPS
   ExecStart=/usr/bin/node server.js
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. **Configure firewall** (if needed):
   ```bash
   sudo ufw allow 3000/tcp
   ```

## Environment Variables

- `PORT`: Server port (default: `3000`)
- `AUTO_DISCOVERY`: Enable/disable auto-discovery (`true`/`false`, default: `true`)

Example:
```bash
PORT=8080 AUTO_DISCOVERY=false node server.js
```

## Project Structure

```
UPS/
├── server.js              # Node.js backend server
├── main.js                # Dashboard frontend logic
├── devices.js             # Device management page
├── alerts.js              # Alerts management page
├── index.html             # Main dashboard
├── devices.html           # Device management page
├── alerts.html            # Alerts page
├── ups-config.json        # UPS device configuration
├── ups-history.sqlite     # Historical data (auto-generated)
├── package.json           # Node.js dependencies
└── resources/            # Images and assets
```

## Dependencies

- **express**: Web server framework
- **net-snmp**: SNMP client for querying UPS devices
- **better-sqlite3**: SQLite database for history storage

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### UPS not responding

1. Check network connectivity: `ping <ups-ip>`
2. Verify SNMP community string matches UPS configuration
3. Test SNMP manually: `snmpget -v2c -c public <ups-ip> 1.3.6.1.2.1.33.1.2.4.0`

### Database errors

- Ensure write permissions in project directory
- Check disk space
- Verify SQLite is installed: `sqlite3 --version`

### Auto-discovery not finding UPSes

- Verify UPSes are on network range `10.40.40.2-30`
- Check SNMP is enabled on UPS devices
- Try manual discovery: `curl -X POST http://localhost:3000/api/discover`

## License

ISC

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Author

Simon Wilkinson

## Acknowledgments

Built for monitoring APC UPS units with NMC3 network management cards via SNMP.

