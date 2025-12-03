# APC UPS Monitoring System - Interaction Design

## System Overview
A comprehensive web-based monitoring system for APC UPS units with NMC3 network cards, providing real-time monitoring, alerts, and management capabilities via SNMP. The system supports automatic network discovery and scales to monitor any number of UPS devices on your network.

## Core Interactions

### 1. Real-Time Dashboard (`index.html`)
**Primary Interface**: Multi-device monitoring grid with live data from SNMP

- **Device Cards**: Dynamic UPS status cards displaying:
  - Online/offline status with color-coded indicators (green/yellow/red)
  - Battery percentage with animated progress bars
  - Load percentage with visual progress indicators
  - Temperature readings from SNMP sensors
  - Estimated runtime calculation
  - IP address and last update timestamp
  - Click card to view detailed information

- **Quick Stats Panel**: Real-time summary statistics
  - Total UPS Units (dynamically calculated)
  - Online Units count
  - Warning Status count
  - Critical Status count

- **Filter Controls**: Status-based filtering
  - All devices
  - Online only
  - Warning status
  - Critical status
  - Active filter highlighted with blue background

- **Search Function**: Real-time search by device name or IP address
  - Instant filtering as you type
  - Case-insensitive matching

- **Auto-Refresh**: Toggle automatic refresh every 30 seconds
  - Visual indicator shows ON/OFF state
  - Manual refresh via page reload

- **Performance Charts**:
  - **Battery Levels Overview**: Pie chart showing distribution of battery levels (Critical/Warning/Good)
  - **Load Distribution**: Bar chart showing load percentage per UPS
  - **UPS Performance Timelines**: Three separate timeline charts:
    - Battery Performance (line chart, all UPSes)
    - Load Performance (line chart, all UPSes)
    - Temperature Performance (line chart, all UPSes)
  - Timeline range selector: 1 day / 2 days / 7 days
  - Hover tooltips show UPS name and value only

### 2. Device Management (`devices.html`)
**Configuration Interface**: UPS device management and configuration

- **Device Table**: Comprehensive list view of all UPS devices
  - Device name with status indicator
  - IP address (monospace font)
  - Model information
  - Status badge (Online/Warning/Offline)
  - Battery level with progress bar
  - Load percentage with progress bar
  - Action buttons: Details, Configure

- **Device Details Modal**: Click "Details" to view:
  - Device information (name, IP, model, serial, firmware)
  - Current status (battery, load, temperature, runtime)
  - Device controls (self-test, reboot, shutdown scheduling)
  - Animated modal appearance/disappearance

- **Configuration Panel**: Network and alert settings
  - SNMP community configuration
  - SNMP version selection
  - Polling interval settings
  - Alert threshold configuration
  - Email notification setup

- **Bulk Actions**:
  - Bulk configure multiple devices
  - Export configuration to JSON file

- **Add Device**: Button to manually add new UPS devices

### 3. Alert Management System (`alerts.html`)
**Notification Interface**: Centralized alert handling with real-time SNMP data

- **Alert Statistics Dashboard**: Four summary cards
  - Critical Alerts count
  - Warning Alerts count
  - Info Alerts count
  - Resolved Today count

- **Active Alerts List**: Real-time alert stream
  - Color-coded by severity (Critical=red, Warning=yellow, Info=blue)
  - Device name and alert message
  - Timestamp with "time ago" format
  - Acknowledgment status badges
  - Quick actions: Acknowledge, Details

- **Alert Filtering**: Filter buttons
  - Critical only
  - Warning only
  - Info only
  - All alerts

- **Alert Detail Modal**: Click alert to view:
  - Alert ID and device name
  - Severity level
  - Timestamp
  - Full alert message
  - Suggested action based on alert type
  - Actions: Acknowledge, Snooze (1h), Escalate

- **Alert Rules Configuration**: Toggleable alert rules
  - Battery Level Critical (below 20%)
  - High Temperature (above 40°C)
  - UPS Offline detection

- **Notification Settings**: 
  - Email recipients configuration
  - SMS notifications
  - Webhook URL for external integrations

- **Alert History Chart**: Timeline visualization
  - Shows alert trends over time
  - Currently displays empty history (ready for future data)

- **Bulk Actions**:
  - Acknowledge All alerts
  - Refresh alerts (re-fetches from SNMP)

### 4. Auto-Discovery System
**Network Discovery**: Automatic UPS detection and configuration

- **Automatic Discovery**: 
  - Scans network range `10.40.40.2-30` every hour
  - Probes each IP for SNMP UPS responses
  - Automatically adds discovered UPSes to `ups-config.json`
  - Generates unique IDs and names (e.g., `UPS-40-5` for IP `10.40.40.5`)

- **Manual Discovery**: 
  - API endpoint: `POST /api/discover`
  - Optional community string parameter
  - Returns discovered UPSes and adds them to config

- **Configuration Management**:
  - UPS devices stored in `ups-config.json`
  - Each UPS has: id, name, ip, community
  - Config automatically reloaded after discovery
  - Manual editing supported

## User Interaction Flows

### Dashboard Interaction Flow
1. **Landing**: User sees grid of all configured UPS devices with real-time status
2. **Quick Scan**: Color-coded status indicators allow immediate issue identification
3. **Filtering**: Use filter buttons to focus on specific status types
4. **Search**: Type device name or IP to quickly find specific UPS
5. **Detail View**: Click device card to see detailed information popup
6. **Timeline Analysis**: Select 1/2/7 day range to view historical performance
7. **Auto-Refresh**: System automatically updates every 30 seconds

### Alert Response Flow
1. **Alert Generation**: System automatically generates alerts based on SNMP thresholds
2. **Visual Notification**: Alerts appear in alerts page with severity indicators
3. **Investigation**: Click alert to view detailed information and suggested actions
4. **Acknowledgment**: Mark alert as acknowledged to track response
5. **Resolution**: System continues monitoring and updates alert status

### Device Discovery Flow
1. **Automatic**: System scans network hourly and adds new UPSes automatically
2. **Manual Trigger**: User can trigger discovery via API call
3. **Configuration**: Discovered UPSes added to `ups-config.json` with generated names
4. **Verification**: New devices appear in dashboard on next refresh
5. **Customization**: User can edit names/IDs in config file as needed

### Timeline Analysis Flow
1. **Range Selection**: User selects 1, 2, or 7 day timeline range
2. **Data Loading**: System fetches historical data from SQLite database
3. **Chart Rendering**: Three separate charts render (Battery, Load, Temperature)
4. **Hover Interaction**: Hover over data points to see UPS name and value
5. **Comparison**: View all UPSes on same timeline for easy comparison

## Interactive Components

### 1. Dynamic Status Grid
- Real-time updating device cards from SNMP polling
- Hover effects with 3D transform animations
- Color-coded status borders (green/yellow/red)
- Smooth animations on data updates
- Responsive grid layout (1-4 columns based on screen size)

### 2. Interactive Charts (ECharts)
- **Battery Pie Chart**: Donut chart showing battery level distribution
- **Load Bar Chart**: Horizontal bars showing load per UPS
- **Timeline Charts**: Multi-line charts showing historical trends
  - Time-based X-axis
  - Multiple UPS series with different colors
  - Custom tooltips showing only UPS name and value
  - Legend for series identification
  - Responsive resizing

### 3. Alert Center
- Live updating alert feed from real SNMP data
- Severity-based color coding
- Filterable by alert type
- Bulk acknowledgment actions
- Modal detail views with suggested actions

### 4. Configuration Management
- JSON-based configuration file (`ups-config.json`)
- Automatic discovery and addition
- Manual editing support
- Export functionality
- Real-time config reloading

## Technical Implementation Notes

### Data Collection
- **SNMP Polling**: Every 30 seconds via `/api/ups` endpoint
- **OIDs Used**:
  - Battery Charge: `1.3.6.1.2.1.33.1.2.4.0`
  - Input Voltage: `1.3.6.1.2.1.33.1.3.3.1.3.1`
  - Output Load: `1.3.6.1.2.1.33.1.4.4.1.5.1`
  - Temperature: `1.3.6.1.2.1.33.1.2.7.0`
- **History Storage**: SQLite database (`ups-history.sqlite`)
  - 7-day retention period
  - Automatic cleanup of old data
  - Indexed for fast queries

### Alert Thresholds
- **Critical Battery**: ≤ 20%
- **Warning Battery**: 20-40%
- **Critical Load**: ≥ 95%
- **Warning Load**: 80-95%
- **Critical Temperature**: ≥ 45°C
- **Warning Temperature**: 40-45°C
- **Offline**: UPS not responding to SNMP queries

### API Endpoints
- `GET /api/ups` - Current status of all UPSes
- `GET /api/ups/history?range=1|2|7` - Historical data for timelines
- `POST /api/discover` - Manual network discovery trigger

### Performance Considerations
- Asynchronous SNMP queries (Promise.all for parallel requests)
- SQLite database for efficient history storage
- Client-side chart rendering with ECharts
- Auto-refresh with configurable interval
- Efficient data filtering and search on frontend

### Network Discovery
- Scans IP range `10.40.40.2-30` (configurable in code)
- SNMP probe timeout: 2 seconds per IP
- Parallel scanning for speed
- Skips already-configured UPSes
- Auto-runs every hour (configurable via `AUTO_DISCOVERY` env var)

### Data Persistence
- **Configuration**: `ups-config.json` (version controlled)
- **History**: `ups-history.sqlite` (local, excluded from git)
- **Automatic Cleanup**: Old history data purged after 7 days

## UI/UX Features

### Visual Design
- **Glassmorphism**: Frosted glass effect on cards and panels
- **Gradient Text**: Cyan-to-blue gradients for headings
- **Color Coding**: 
  - Green: Online/Good status
  - Yellow: Warning status
  - Red: Critical/Offline status
  - Blue: Informational/Neutral

### Animations
- **Page Load**: Staggered card animations using Anime.js
- **Text Splitting**: Hero text character-by-character animation
- **Hover Effects**: Card lift and rotation on hover
- **Status Pulse**: Pulsing indicator for online status
- **Modal Transitions**: Smooth scale and fade animations

### Responsive Design
- Mobile-friendly grid layouts
- Adaptive column counts (1-4 columns)
- Touch-friendly button sizes
- Responsive charts that resize with window

This interaction design provides a comprehensive, user-friendly interface for managing APC UPS units via SNMP, with automatic discovery, real-time monitoring, historical analysis, and intelligent alerting.
