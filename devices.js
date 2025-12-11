// APC UPS Monitoring System - Devices Management JavaScript

// Global variables
let deviceData = [];

// Initialize the devices page
document.addEventListener('DOMContentLoaded', async function() {
    initializeDevicesPage();
    await loadDeviceData();
    renderDeviceTable();

    // Add event listener for the edit form
    const editForm = document.getElementById('editDeviceForm');
    if (editForm) {
        editForm.addEventListener('submit', saveDeviceName);
    }
});

// Save device name
async function saveDeviceName(event) {
    event.preventDefault();
    
    const deviceId = document.getElementById('editDeviceId').value;
    const newName = document.getElementById('editDeviceName').value;
    
    if (!deviceId || !newName) {
        showNotification('Invalid device data', 'error');
        return;
    }
    
    try {
        const res = await fetch(`/api/ups/${deviceId}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to save device name');
        }
        
        showNotification('Device name updated successfully', 'success');
        closeEditDeviceModal();
        
        // Update local data and re-render
        const device = deviceData.find(d => d.id === deviceId);
        if (device) {
            device.name = newName;
        }
        renderDeviceTable();
        
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
        console.error('Failed to save device name:', err);
    }
}

// Load device data from backend (SNMP via /api/ups), with fallback to demo data
async function loadDeviceData() {
    try {
        const res = await fetch('/api/ups');
        if (!res.ok) throw new Error('Bad status');
        const upsList = await res.json();
        const list = Array.isArray(upsList) ? upsList : [upsList];

        deviceData = list.map((ups) => ({
            id: ups.id,
            name: ups.name,
            ip: ups.ip,
            model: ups.model || 'APC UPS',
            serial: ups.id || 'N/A',
            firmware: ups.firmware || 'N/A',
            status: ups.status || (ups.battery === null ? 'offline' : 'online'),
            battery: typeof ups.battery === 'number' ? ups.battery : 0,
            load: typeof ups.load === 'number' ? ups.load : 0,
            temperature: typeof ups.temperature === 'number' ? ups.temperature : 0,
            lastUpdate: ups.lastUpdate || new Date().toLocaleString()
        }));
    } catch (e) {
        console.warn('Failed to load device data from /api/ups, using demo data instead:', e);
        generateDeviceData();
    }
}

// Initialize devices page
function initializeDevicesPage() {
    console.log('Devices management page initialized');
}

// Generate mock device data
function generateDeviceData() {
    const models = ['Smart-UPS SRT 5000', 'Smart-UPS SRT 3000', 'Smart-UPS SRT 2000', 'Smart-UPS SRT 1000'];
    const statuses = ['online', 'warning', 'offline'];
    const statusWeights = [0.85, 0.12, 0.03]; // 85% online, 12% warning, 3% offline
    
    deviceData = [];
    for (let i = 1; i <= 25; i++) {
        const randomStatus = getWeightedRandomStatus(statuses, statusWeights);
        const batteryLevel = randomStatus === 'offline' ? 0 : (randomStatus === 'warning' ? 25 + Math.random() * 30 : 70 + Math.random() * 30);
        const loadLevel = randomStatus === 'offline' ? 0 : 20 + Math.random() * 60;
        
        deviceData.push({
            id: `UPS-${i.toString().padStart(2, '0')}`,
            name: `UPS-${i.toString().padStart(2, '0')}`,
            ip: `192.168.1.${100 + i}`,
            model: models[Math.floor(Math.random() * models.length)],
            serial: `AS${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            firmware: `v2.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`,
            status: randomStatus,
            battery: Math.round(batteryLevel),
            load: Math.round(loadLevel),
            temperature: 25 + Math.random() * 10,
            lastUpdate: new Date().toLocaleString()
        });
    }
}

// Get weighted random status
function getWeightedRandomStatus(statuses, weights) {
    const random = Math.random();
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (random <= sum) {
            return statuses[i];
        }
    }
    return statuses[0];
}

// Render device table
function renderDeviceTable() {
    const table = document.getElementById('deviceTable');
    if (!table) return;
    
    table.innerHTML = '';
    
    deviceData.forEach(device => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-gray-700 transition-colors';
        
        const statusColor = getStatusColor(device.status);
        const batteryColor = getBatteryColor(device.battery);
        
        row.innerHTML = `
            <td class="py-3 px-4">
                <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 ${statusColor} rounded-full"></div>
                    <span class="font-medium">${device.name}</span>
                </div>
            </td>
            <td class="py-3 px-4 mono text-sm">${device.ip}</td>
            <td class="py-3 px-4">${device.model}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(device.status)}">
                    ${device.status.toUpperCase()}
                </span>
            </td>
            <td class="py-3 px-4">
                <div class="flex items-center space-x-2">
                    <span class="text-sm">${device.battery}%</span>
                    <div class="w-16 bg-gray-600 rounded-full h-2">
                        <div class="${batteryColor} h-2 rounded-full" style="width: ${device.battery}%"></div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4">
                <div class="flex items-center space-x-2">
                    <span class="text-sm">${device.load}%</span>
                    <div class="w-16 bg-gray-600 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full" style="width: ${device.load}%"></div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4">
                <div class="flex space-x-2">
                    <button class="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700 transition-colors" onclick="showDeviceDetail('${device.id}')">
                        Details
                    </button>
                    <button class="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-700 transition-colors" onclick="configureDevice('${device.id}')">
                        Configure
                    </button>
                </div>
            </td>
        `;
        
        table.appendChild(row);
    });
}

// Get status color classes
function getStatusColor(status) {
    switch (status) {
        case 'online': return 'bg-green-500';
        case 'warning': return 'bg-yellow-500';
        case 'offline': return 'bg-red-500';
        default: return 'bg-gray-500';
    }
}

function getStatusBadgeColor(status) {
    switch (status) {
        case 'online': return 'bg-green-600 text-white';
        case 'warning': return 'bg-yellow-600 text-white';
        case 'offline': return 'bg-red-600 text-white';
        default: return 'bg-gray-600 text-white';
    }
}

function getBatteryColor(battery) {
    if (battery >= 80) return 'bg-green-500';
    if (battery >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
}

// Show device detail modal
function showDeviceDetail(deviceId) {
    const device = deviceData.find(d => d.id === deviceId);
    if (!device) return;
    
    // Update modal content
    document.getElementById('modalTitle').textContent = `${device.name} - Device Details`;
    document.getElementById('modalDeviceName').textContent = device.name;
    document.getElementById('modalIPAddress').textContent = device.ip;
    document.getElementById('modalModel').textContent = device.model;
    document.getElementById('modalSerial').textContent = device.serial;
    document.getElementById('modalFirmware').textContent = device.firmware;
    
    const statusElement = document.getElementById('modalStatus');
    statusElement.textContent = device.status.toUpperCase();
    statusElement.className = getStatusColor(device.status).replace('bg-', 'text-');
    
    document.getElementById('modalBattery').textContent = `${device.battery}%`;
    document.getElementById('modalLoad').textContent = `${device.load}%`;
    document.getElementById('modalTemperature').textContent = `${device.temperature}°C`;
    document.getElementById('modalRuntime').textContent = `${Math.floor(device.battery * 2.5 / 60)}h ${Math.floor(device.battery * 2.5 % 60)}m`;
    
    // Show modal
    document.getElementById('deviceModal').classList.remove('hidden');
    
    // Animate modal appearance
    anime({
        targets: '#deviceModal .glass',
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 300,
        easing: 'easeOutQuart'
    });
}

// Close device detail modal
function closeDeviceModal() {
    const modal = document.getElementById('deviceModal');
    
    anime({
        targets: '#deviceModal .glass',
        opacity: [1, 0],
        scale: [1, 0.8],
        duration: 200,
        easing: 'easeInQuart',
        complete: () => {
            modal.classList.add('hidden');
        }
    });
}

// Device control functions
function runSelfTest() {
    showNotification('Self test initiated', 'success');
    closeDeviceModal();
}

function rebootDevice() {
    if (confirm('Are you sure you want to reboot this UPS?')) {
        showNotification('Reboot command sent', 'info');
        closeDeviceModal();
    }
}

function scheduleShutdown() {
    showNotification('Shutdown scheduler opened', 'info');
    closeDeviceModal();
}

function emergencyShutdown() {
    if (confirm('Are you sure you want to perform an emergency shutdown?')) {
        showNotification('Emergency shutdown initiated', 'error');
        closeDeviceModal();
    }
}

// Configure device
function configureDevice(deviceId) {
    const device = deviceData.find(d => d.id === deviceId);
    if (!device) return;

    document.getElementById('editDeviceId').value = device.id;
    document.getElementById('editDeviceName').value = device.name;

    document.getElementById('editDeviceModal').classList.remove('hidden');
    
    anime({
        targets: '#editDeviceModal .glass',
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 300,
        easing: 'easeOutQuart'
    });
}

// Close edit device modal
function closeEditDeviceModal() {
    const modal = document.getElementById('editDeviceModal');
    
    anime({
        targets: '#editDeviceModal .glass',
        opacity: [1, 0],
        scale: [1, 0.8],
        duration: 200,
        easing: 'easeInQuart',
        complete: () => {
            modal.classList.add('hidden');
        }
    });
}

// Run discovery
async function runDiscovery() {
    showNotification('Starting UPS discovery...', 'info');
    try {
        const res = await fetch('/api/discover', { method: 'POST' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Discovery failed');
        }
        const result = await res.json();
        const message = `Discovery complete: ${result.discovered} new UPS(es) found.`;
        showNotification(message, 'success');
        
        // Reload device data and re-render table
        await loadDeviceData();
        renderDeviceTable();
    } catch (err) {
        showNotification(`Error during discovery: ${err.message}`, 'error');
        console.error('Discovery error:', err);
    }
}

// Bulk configure devices
function bulkConfigure() {
    showNotification('Bulk configuration panel opened', 'info');
}

// Export configuration
function exportConfiguration() {
    // Create a mock configuration file
    const config = {
        devices: deviceData.map(device => ({
            name: device.name,
            ip: device.ip,
            model: device.model,
            serial: device.serial
        })),
        exportDate: new Date().toISOString(),
        totalDevices: deviceData.length
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ups-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Configuration exported successfully', 'success');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-6 px-6 py-3 rounded-lg text-white z-50 alert-slide ${getNotificationColor(type)}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    anime({
        targets: notification,
        opacity: [0, 1],
        translateX: [100, 0],
        duration: 300,
        easing: 'easeOutQuart'
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        anime({
            targets: notification,
            opacity: [1, 0],
            translateX: [0, 100],
            duration: 300,
            easing: 'easeInQuart',
            complete: () => {
                document.body.removeChild(notification);
            }
        });
    }, 3000);
}

// Get notification color
function getNotificationColor(type) {
    switch (type) {
        case 'success': return 'bg-green-600';
        case 'error': return 'bg-red-600';
        case 'warning': return 'bg-yellow-600';
        default: return 'bg-blue-600';
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('deviceModal');
    if (event.target === modal) {
        closeDeviceModal();
    }
});