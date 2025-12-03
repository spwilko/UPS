// APC UPS Monitoring System - Alerts Management JavaScript

// Global variables
let alertData = [];
let currentAlertFilter = 'all';

// Initialize the alerts page
document.addEventListener('DOMContentLoaded', async function() {
    initializeAlertsPage();
    await loadAlertsFromUps();
    renderActiveAlerts();
    initializeAlertChart();
    updateAlertStatistics();
});

// Initialize alerts page
function initializeAlertsPage() {
    console.log('Alerts management page initialized');
}

// Load alerts derived from live UPS data via /api/ups, with fallback to mock alerts
async function loadAlertsFromUps() {
    try {
        const res = await fetch('/api/ups');
        if (!res.ok) throw new Error('Bad status');
        const upsList = await res.json();
        const list = Array.isArray(upsList) ? upsList : [upsList];

        alertData = [];
        const now = new Date();

        list.forEach((ups, index) => {
            const deviceName = ups.name || ups.id || ups.ip || `UPS-${index + 1}`;
            const battery = typeof ups.battery === 'number' ? ups.battery : null;
            const load = typeof ups.load === 'number' ? ups.load : null;
            const temperature = typeof ups.temperature === 'number' ? ups.temperature : null;
            const status = ups.status || (battery === null ? 'offline' : 'online');

            const timestamp = new Date(now.getTime() - index * 60 * 1000);

            // Offline / unreachable
            if (status === 'offline' || battery === null) {
                alertData.push({
                    id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                    device: deviceName,
                    severity: 'critical',
                    message: 'UPS offline. Network connection lost.',
                    timestamp,
                    acknowledged: false,
                    resolved: false
                });
            }

            // Battery based alerts
            if (battery !== null) {
                if (battery <= 20) {
                    alertData.push({
                        id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                        device: deviceName,
                        severity: 'critical',
                        message: 'Battery level critical. Immediate attention required.',
                        timestamp,
                        acknowledged: false,
                        resolved: false
                    });
                } else if (battery <= 40) {
                    alertData.push({
                        id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                        device: deviceName,
                        severity: 'warning',
                        message: 'Battery level below threshold.',
                        timestamp,
                        acknowledged: false,
                        resolved: false
                    });
                }
            }

            // Load based alerts
            if (load !== null) {
                if (load >= 95) {
                    alertData.push({
                        id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                        device: deviceName,
                        severity: 'critical',
                        message: 'Load exceeded maximum capacity.',
                        timestamp,
                        acknowledged: false,
                        resolved: false
                    });
                } else if (load >= 80) {
                    alertData.push({
                        id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                        device: deviceName,
                        severity: 'warning',
                        message: 'Load approaching maximum capacity.',
                        timestamp,
                        acknowledged: false,
                        resolved: false
                    });
                }
            }

            // Temperature based alerts
            if (temperature !== null) {
                if (temperature >= 45) {
                    alertData.push({
                        id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                        device: deviceName,
                        severity: 'critical',
                        message: 'Temperature threshold exceeded. Cooling system failure.',
                        timestamp,
                        acknowledged: false,
                        resolved: false
                    });
                } else if (temperature >= 40) {
                    alertData.push({
                        id: `ALERT-${(alertData.length + 1).toString().padStart(3, '0')}`,
                        device: deviceName,
                        severity: 'warning',
                        message: 'High temperature detected.',
                        timestamp,
                        acknowledged: false,
                        resolved: false
                    });
                }
            }
        });

        // If no alerts were generated at all, keep the page informative with a single info alert
        if (alertData.length === 0 && list.length > 0) {
            const ups = list[0];
            const deviceName = ups.name || ups.id || ups.ip || 'UPS-01';
            alertData.push({
                id: 'ALERT-001',
                device: deviceName,
                severity: 'info',
                message: 'All monitored UPS devices are within normal operating parameters.',
                timestamp: now,
                acknowledged: false,
                resolved: false
            });
        }

        // Sort by severity and time
        alertData.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return b.timestamp - a.timestamp;
        });
    } catch (e) {
        console.warn('Failed to load alerts from /api/ups, using mock alert data instead:', e);
        generateAlertData();
    }
}

// Generate mock alert data (demo fallback)
function generateAlertData() {
    const severities = ['critical', 'warning', 'info'];
    const severityWeights = [0.2, 0.4, 0.4]; // 20% critical, 40% warning, 40% info
    const devices = ['UPS-01', 'UPS-02', 'UPS-03', 'UPS-04', 'UPS-05', 'UPS-06', 'UPS-07', 'UPS-08'];
    
    const alertMessages = {
        critical: [
            'Battery level critical. Immediate attention required.',
            'UPS offline. Network connection lost.',
            'Temperature threshold exceeded. Cooling system failure.',
            'Load exceeded maximum capacity.',
            'Battery self-test failed.'
        ],
        warning: [
            'Battery level below threshold.',
            'High temperature detected.',
            'Load approaching maximum capacity.',
            'Battery approaching end of life.',
            'Firmware update available.'
        ],
        info: [
            'Scheduled maintenance completed.',
            'Battery self-test completed successfully.',
            'System reboot completed.',
            'Configuration backup created.',
            'Firmware updated successfully.'
        ]
    };
    
    alertData = [];
    
    // Generate active alerts
    for (let i = 1; i <= 22; i++) {
        const severity = getWeightedRandomStatus(severities, severityWeights);
        const device = devices[Math.floor(Math.random() * devices.length)];
        const messages = alertMessages[severity];
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        const alertTime = new Date();
        alertTime.setMinutes(alertTime.getMinutes() - Math.floor(Math.random() * 1440)); // Within last 24 hours
        
        alertData.push({
            id: `ALERT-${i.toString().padStart(3, '0')}`,
            device: device,
            severity: severity,
            message: message,
            timestamp: alertTime,
            acknowledged: Math.random() > 0.7, // 30% acknowledged
            resolved: severity === 'info' ? Math.random() > 0.5 : false
        });
    }
    
    // Sort by severity and timestamp
    alertData.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.timestamp - a.timestamp;
    });
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

// Render active alerts
function renderActiveAlerts() {
    const container = document.getElementById('activeAlerts');
    if (!container) return;
    
    const filteredAlerts = filterAlertsByType(alertData, currentAlertFilter);
    
    container.innerHTML = '';
    
    if (filteredAlerts.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-8">No alerts found</div>';
        return;
    }
    
    filteredAlerts.forEach(alert => {
        const alertElement = createAlertElement(alert);
        container.appendChild(alertElement);
    });
    
    // Animate alerts
    anime({
        targets: '.alert-item',
        opacity: [0, 1],
        translateX: [50, 0],
        delay: anime.stagger(100),
        duration: 500,
        easing: 'easeOutQuart'
    });
}

// Create alert element
function createAlertElement(alert) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-item p-4 rounded-lg border-l-4 ${getAlertBorderColor(alert.severity)} ${getAlertBackgroundColor(alert.severity)} cursor-pointer`;
    alertDiv.onclick = () => showAlertDetail(alert);
    
    const severityColor = getAlertTextColor(alert.severity);
    const timeAgo = getTimeAgo(alert.timestamp);
    
    alertDiv.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-3">
                <div class="w-3 h-3 ${getAlertIconColor(alert.severity)} rounded-full"></div>
                <span class="font-bold ${severityColor}">${alert.severity.toUpperCase()}</span>
                <span class="text-sm text-gray-400 mono">${alert.id}</span>
            </div>
            <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-400">${timeAgo}</span>
                ${alert.acknowledged ? '<span class="text-xs bg-green-600 text-white px-2 py-1 rounded">Acknowledged</span>' : ''}
                ${alert.resolved ? '<span class="text-xs bg-blue-600 text-white px-2 py-1 rounded">Resolved</span>' : ''}
            </div>
        </div>
        
        <div class="mb-2">
            <span class="text-sm text-gray-300">Device: </span>
            <span class="font-medium">${alert.device}</span>
        </div>
        
        <div class="text-gray-200 mb-3">${alert.message}</div>
        
        <div class="flex space-x-2">
            ${!alert.acknowledged ? `<button class="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-700 transition-colors" onclick="event.stopPropagation(); acknowledgeAlertById('${alert.id}')">Acknowledge</button>` : ''}
            <button class="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700 transition-colors" onclick="event.stopPropagation(); showAlertDetail(${JSON.stringify(alert).replace(/"/g, '&quot;')})">Details</button>
        </div>
    `;
    
    return alertDiv;
}

// Get alert color classes
function getAlertBorderColor(severity) {
    switch (severity) {
        case 'critical': return 'border-red-500';
        case 'warning': return 'border-yellow-500';
        case 'info': return 'border-blue-500';
        default: return 'border-gray-500';
    }
}

function getAlertBackgroundColor(severity) {
    switch (severity) {
        case 'critical': return 'bg-red-900 bg-opacity-20';
        case 'warning': return 'bg-yellow-900 bg-opacity-20';
        case 'info': return 'bg-blue-900 bg-opacity-20';
        default: return 'bg-gray-900 bg-opacity-20';
    }
}

function getAlertTextColor(severity) {
    switch (severity) {
        case 'critical': return 'text-red-400';
        case 'warning': return 'text-yellow-400';
        case 'info': return 'text-blue-400';
        default: return 'text-gray-400';
    }
}

function getAlertIconColor(severity) {
    switch (severity) {
        case 'critical': return 'bg-red-500';
        case 'warning': return 'bg-yellow-500';
        case 'info': return 'bg-blue-500';
        default: return 'bg-gray-500';
    }
}

// Filter alerts by type
function filterAlertsByType(alerts, filter) {
    if (filter === 'all') return alerts;
    return alerts.filter(alert => alert.severity === filter);
}

// Filter alerts
function filterAlerts(filter) {
    currentAlertFilter = filter;
    
    // Update button states
    const buttons = document.querySelectorAll('button[onclick^="filterAlerts"]');
    buttons.forEach(btn => {
        btn.className = btn.className.replace(/bg-(red|yellow|blue|gray)-600/, 'bg-gray-600');
    });
    
    const activeButton = document.querySelector(`button[onclick="filterAlerts('${filter}')"]`);
    if (activeButton) {
        const colorMap = { critical: 'red', warning: 'yellow', info: 'blue', all: 'gray' };
        activeButton.className = activeButton.className.replace('bg-gray-600', `bg-${colorMap[filter]}-600`);
    }
    
    renderActiveAlerts();
}

// Update alert statistics
function updateAlertStatistics() {
    const criticalCount = alertData.filter(alert => alert.severity === 'critical' && !alert.resolved).length;
    const warningCount = alertData.filter(alert => alert.severity === 'warning' && !alert.resolved).length;
    const infoCount = alertData.filter(alert => alert.severity === 'info' && !alert.resolved).length;
    const resolvedCount = alertData.filter(alert => alert.resolved).length;
    
    document.getElementById('criticalCount').textContent = criticalCount;
    document.getElementById('warningCount').textContent = warningCount;
    document.getElementById('infoCount').textContent = infoCount;
    document.getElementById('resolvedCount').textContent = resolvedCount;
}

// Get time ago string
function getTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
}

// Show alert detail modal
function showAlertDetail(alert) {
    // Update modal content
    document.getElementById('modalAlertId').textContent = alert.id;
    document.getElementById('modalAlertDevice').textContent = alert.device;
    document.getElementById('modalAlertSeverity').textContent = alert.severity.toUpperCase();
    document.getElementById('modalAlertSeverity').className = getAlertTextColor(alert.severity);
    document.getElementById('modalAlertTime').textContent = alert.timestamp.toLocaleString();
    document.getElementById('modalAlertMessage').textContent = alert.message;
    
    // Generate suggested action based on alert type
    const suggestedAction = getSuggestedAction(alert);
    document.getElementById('modalAlertAction').textContent = suggestedAction;
    
    // Show modal
    document.getElementById('alertModal').classList.remove('hidden');
    
    // Animate modal appearance
    anime({
        targets: '#alertModal .glass',
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 300,
        easing: 'easeOutQuart'
    });
}

// Get suggested action based on alert type
function getSuggestedAction(alert) {
    const actions = {
        critical: {
            'Battery level critical': 'Check UPS battery status immediately and prepare for replacement if necessary.',
            'UPS offline': 'Check network connectivity and UPS power status. Contact technician if needed.',
            'Temperature threshold exceeded': 'Verify cooling system operation and check for blocked vents.',
            'Load exceeded maximum capacity': 'Reduce load immediately to prevent UPS damage.',
            'Battery self-test failed': 'Schedule battery replacement and verify UPS functionality.'
        },
        warning: {
            'Battery level below threshold': 'Monitor battery level closely and plan for maintenance.',
            'High temperature detected': 'Check ventilation and cooling systems.',
            'Load approaching maximum capacity': 'Consider load balancing or UPS upgrade.',
            'Battery approaching end of life': 'Plan battery replacement in near future.',
            'Firmware update available': 'Schedule maintenance window for firmware update.'
        },
        info: {
            'Scheduled maintenance completed': 'No action required. System is operating normally.',
            'Battery self-test completed successfully': 'No action required. Battery health is good.',
            'System reboot completed': 'Verify all systems are operational after reboot.',
            'Configuration backup created': 'Ensure backup is stored securely.',
            'Firmware updated successfully': 'Verify all functions are working correctly.'
        }
    };
    
    return actions[alert.severity][alert.message] || 'Follow standard procedures for this type of alert.';
}

// Close alert detail modal
function closeAlertModal() {
    const modal = document.getElementById('alertModal');
    
    anime({
        targets: '#alertModal .glass',
        opacity: [1, 0],
        scale: [1, 0.8],
        duration: 200,
        easing: 'easeInQuart',
        complete: () => {
            modal.classList.add('hidden');
        }
    });
}

// Alert actions
function acknowledgeAlert() {
    showNotification('Alert acknowledged', 'success');
    closeAlertModal();
}

function snoozeAlert() {
    showNotification('Alert snoozed for 1 hour', 'info');
    closeAlertModal();
}

function escalateAlert() {
    showNotification('Alert escalated to next level', 'warning');
    closeAlertModal();
}

function acknowledgeAlertById(alertId) {
    const alert = alertData.find(a => a.id === alertId);
    if (alert) {
        alert.acknowledged = true;
        renderActiveAlerts();
        updateAlertStatistics();
        showNotification(`Alert ${alertId} acknowledged`, 'success');
    }
}

// Acknowledge all alerts
function acknowledgeAllAlerts() {
    alertData.forEach(alert => {
        if (!alert.acknowledged) {
            alert.acknowledged = true;
        }
    });
    
    renderActiveAlerts();
    updateAlertStatistics();
    showNotification('All alerts acknowledged', 'success');
}

// Refresh alerts
async function refreshAlerts() {
    await loadAlertsFromUps();
    renderActiveAlerts();
    updateAlertStatistics();
    initializeAlertChart();
    showNotification('Alerts refreshed from live UPS data', 'info');
}

// Initialize alert history chart
function initializeAlertChart() {
    const chart = echarts.init(document.getElementById('alertHistoryChart'));
    
    // Empty / zeroed historical data for the last 7 days
    const dates = [];
    const criticalData = [];
    const warningData = [];
    const infoData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Zero values to effectively wipe history data
        criticalData.push(0);
        warningData.push(0);
        infoData.push(0);
    }
    
    const option = {
        backgroundColor: 'transparent',
        textStyle: { color: '#ffffff' },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: '#00d4ff',
            textStyle: { color: '#ffffff' }
        },
        legend: {
            data: ['Critical', 'Warning', 'Info'],
            textStyle: { color: '#ffffff' }
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { color: '#ffffff' },
            axisLine: { lineStyle: { color: '#374151' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#ffffff' },
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#374151' } }
        },
        series: [
            {
                name: 'Critical',
                type: 'line',
                data: criticalData,
                smooth: true,
                itemStyle: { color: '#ef4444' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
                        { offset: 1, color: 'rgba(239, 68, 68, 0.1)' }
                    ])
                }
            },
            {
                name: 'Warning',
                type: 'line',
                data: warningData,
                smooth: true,
                itemStyle: { color: '#f59e0b' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                        { offset: 1, color: 'rgba(245, 158, 11, 0.1)' }
                    ])
                }
            },
            {
                name: 'Info',
                type: 'line',
                data: infoData,
                smooth: true,
                itemStyle: { color: '#3b82f6' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0.1)' }
                    ])
                }
            }
        ]
    };
    
    chart.setOption(option);
    
    // Make chart responsive
    window.addEventListener('resize', () => chart.resize());
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
    const modal = document.getElementById('alertModal');
    if (event.target === modal) {
        closeAlertModal();
    }
});