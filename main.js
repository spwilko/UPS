// APC UPS Monitoring System - Main JavaScript

// Global variables
let autoRefreshInterval;
let autoRefreshEnabled = true;
let upsData = [];
let currentFilter = 'all';
let currentTimelineRangeDays = 1;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
	// Page-specific initializations
	if (document.getElementById('upsGrid')) { // Dashboard page
		initializeApp();
		upsData = await fetchUPSData();
		renderUPSGrid();
		initializeCharts();
		startAutoRefresh();
		initializeAnimations();
	} else if (document.getElementById('deviceList')) { // Mobile page
		initializeMobilePage();
	} else if (document.getElementById('performanceChart')) {
		// Performance page is handled by its own script
	}
});

// Initialize application
function initializeApp() {
    console.log('APC UPS Monitoring System initialized');
    
    // Set up search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleDashboardSearch);
    }
    
    // Initialize text splitting animation
    if (typeof Splitting !== 'undefined') {
        Splitting();
    }
}
async function fetchUPSData() {
    try {
        const res = await fetch('/api/ups');
        if (!res.ok) throw new Error('Bad status');
        const upsList = await res.json();
        // Expect an array from the backend; if it's a single object, wrap it
        return Array.isArray(upsList) ? upsList : [upsList];
    } catch (e) {
        console.warn('Failed to fetch SNMP data, using mock data:', e);
        generateUPSData();
        return upsData;
    }
}
// Generate mock UPS data
function generateUPSData() {
    const models = ['Smart-UPS SRT 5000', 'Smart-UPS SRT 3000', 'Smart-UPS SRT 2000', 'Smart-UPS SRT 1000'];
    const statuses = ['online', 'warning', 'critical'];
    const statusWeights = [0.8, 0.15, 0.05]; // 80% online, 15% warning, 5% critical
    
    upsData = [];
    for (let i = 1; i <= 25; i++) {
        const randomStatus = getWeightedRandomStatus(statuses, statusWeights);
        const batteryLevel = randomStatus === 'critical' ? Math.random() * 30 : 80 + Math.random() * 20;
        const loadLevel = 20 + Math.random() * 60;
        const temperature = 25 + Math.random() * 15;
        
        upsData.push({
            id: `UPS-${i.toString().padStart(2, '0')}`,
            name: `UPS-${i.toString().padStart(2, '0')}`,
            ip: `192.168.1.${100 + i}`,
            model: models[Math.floor(Math.random() * models.length)],
            status: randomStatus,
            battery: Math.round(batteryLevel),
            load: Math.round(loadLevel),
            temperature: Math.round(temperature * 10) / 10,
            runtime: Math.round(batteryLevel * 2.5),
            lastUpdate: new Date().toLocaleTimeString()
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

// Render UPS grid
function renderUPSGrid() {
    const grid = document.getElementById('upsGrid');
    if (!grid) return;
    
    const filteredData = filterUPSData(upsData, currentFilter);
    
    grid.innerHTML = '';
    filteredData.forEach(ups => {
        const card = createUPSCard(ups);
        grid.appendChild(card);
    });
    
    // Animate cards
    anime({
        targets: '#upsGrid .device-item',
        opacity: [0, 1],
        translateY: [20, 0],
        delay: anime.stagger(50),
        duration: 600,
        easing: 'easeOutQuart'
    });
}

// Create UPS card element
function createUPSCard(ups) { // Renamed from createUPSCard to createUPSRow for clarity
    const item = document.createElement('div');
    item.className = `device-item glass rounded-lg p-3 grid grid-cols-12 gap-2 items-center text-sm`;
    item.dataset.name = ups.name;

    const statusColor = getStatusColor(ups.status);

    item.innerHTML = `
        <div class="col-span-4">
            <a href="performance.html?upsId=${ups.id}" class="font-bold hover:text-blue-400 transition-colors truncate">${ups.name}</a>
        </div>
        <div class="col-span-3 flex items-center space-x-2">
            <div class="w-2.5 h-2.5 ${statusColor} rounded-full"></div>
            <span class="capitalize">${ups.status}</span>
        </div>
        <div class="col-span-2 text-center font-semibold">${ups.battery}%</div>
        <div class="col-span-2 text-center font-semibold">${ups.load}%</div>
        <div class="col-span-1 text-center font-semibold">${ups.temperature}°C</div>
    `;

    return item;
}

// Get status color classes
function getStatusColor(status) {
    switch (status) {
        case 'online': return 'bg-green-500';
        case 'warning': return 'bg-yellow-500';
        case 'critical': return 'bg-red-500';
        default: return 'bg-gray-500';
    }
}

function getStatusBorderColor(status) {
    switch (status) {
        case 'online': return 'border-green-500';
        case 'warning': return 'border-yellow-500';
        case 'critical': return 'border-red-500';
        default: return 'border-gray-500';
    }
}

function getBatteryColor(battery) {
    if (battery >= 80) return 'bg-green-500';
    if (battery >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
}

// Filter UPS data
function filterUPSData(data, filter) {
    if (filter === 'all') return data;
    return data.filter(ups => ups.status === filter);
}

// Filter devices
function filterDevices(filter) {
    currentFilter = filter;
    
    // Update button states
    const buttons = document.querySelectorAll('button[onclick^="filterDevices"]');
    buttons.forEach(btn => {
        btn.className = btn.className.replace('bg-blue-600', 'bg-gray-600');
    });
    
    const activeButton = document.querySelector(`button[onclick="filterDevices('${filter}')"]`);
    if (activeButton) {
        activeButton.className = activeButton.className.replace('bg-gray-600', 'bg-blue-600');
    }
    
    renderUPSGrid();
}

// Handle search
function handleDashboardSearch(event) {
    const query = event.target.value.toLowerCase();
    const upsGrid = document.getElementById('upsGrid');
    const upsItems = upsGrid.querySelectorAll('.device-item');
    
    upsItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = 'grid'; // Use 'grid' to maintain the grid layout
        } else {
            item.style.display = 'none';
        }
    });
}

// Show UPS detail
function showUPSDetail(ups) {
    // For now, just show an alert. In a real app, this would open a modal or navigate to a detail page
    alert(`UPS Details:\n\nName: ${ups.name}\nIP: ${ups.ip}\nModel: ${ups.model}\nStatus: ${ups.status}\nBattery: ${ups.battery}%\nLoad: ${ups.load}%\nTemperature: ${ups.temperature}°C`);
}

// Toggle auto refresh
function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const button = document.getElementById('autoRefreshText');
    
    if (autoRefreshEnabled) {
        button.textContent = 'Auto Refresh: ON';
        startAutoRefresh();
    } else {
        button.textContent = 'Auto Refresh: OFF';
        stopAutoRefresh();
    }
}

// Start auto refresh
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    
    autoRefreshInterval = setInterval(async () => {
        upsData = await fetchUPSData();
        updateDashboardStats();
        updateCharts();
    }, 30000);
}

// Stop auto refresh
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Initialize charts
function initializeCharts() {
}

// Initialize timeline charts on first load
document.addEventListener('DOMContentLoaded', function() {
    // Slight delay to ensure layout is ready
    setTimeout(() => {
        initializeTimelineCharts();
    }, 500); // Delay to ensure DOM is ready
});

// Initialize performance charts (battery, load, temperature per UPS)
function initializePerformanceCharts() {
    const batteryEl = document.getElementById('batteryPerformanceChart');
    const loadEl = document.getElementById('loadPerformanceChart');
    const tempEl = document.getElementById('tempPerformanceChart');

    if (!batteryEl || !loadEl || !tempEl || !upsData || upsData.length === 0) {
        return;
    }

    const names = upsData.map(ups => ups.name);

    const batteryValues = upsData.map(ups =>
        typeof ups.battery === 'number' ? ups.battery : 0
    );
    const loadValues = upsData.map(ups =>
        typeof ups.load === 'number' ? ups.load : 0
    );
    const tempValues = upsData.map(ups =>
        typeof ups.temperature === 'number' ? ups.temperature : 0
    );

    const commonAxis = {
        type: 'category',
        data: names,
        axisLabel: {
            color: '#ffffff',
            interval: 0,
            rotate: 45,
            fontSize: 10
        },
        axisLine: { lineStyle: { color: '#374151' } }
    };

    const commonYAxisPercent = {
        type: 'value',
        max: 100,
        axisLabel: { color: '#ffffff', formatter: '{value}%' },
        axisLine: { lineStyle: { color: '#374151' } },
        splitLine: { lineStyle: { color: '#374151' } }
    };

    const commonYAxisTemp = {
        type: 'value',
        axisLabel: { color: '#ffffff', formatter: '{value}°C' },
        axisLine: { lineStyle: { color: '#374151' } },
        splitLine: { lineStyle: { color: '#374151' } }
    };

    function makeTooltip(unit) {
        return {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: '#00d4ff',
            textStyle: { color: '#ffffff' },
            formatter: function (params) {
                const p = Array.isArray(params) ? params[0] : params;
                return `${p.name}: ${p.value}${unit}`;
            }
        };
    }

    // Battery chart
    const batteryChart = echarts.init(batteryEl);
    batteryChart.setOption({
        backgroundColor: 'transparent',
        textStyle: { color: '#ffffff' },
        tooltip: makeTooltip('%'),
        xAxis: commonAxis,
        yAxis: commonYAxisPercent,
        series: [{
            type: 'bar',
            data: batteryValues,
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#10b981' },
                    { offset: 1, color: '#059669' }
                ])
            }
        }]
    });

    // Load chart
    const loadChart = echarts.init(loadEl);
    loadChart.setOption({
        backgroundColor: 'transparent',
        textStyle: { color: '#ffffff' },
        tooltip: makeTooltip('%'),
        xAxis: commonAxis,
        yAxis: commonYAxisPercent,
        series: [{
            type: 'bar',
            data: loadValues,
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#00d4ff' },
                    { offset: 1, color: '#3b82f6' }
                ])
            }
        }]
    });

    // Temperature chart
    const tempChart = echarts.init(tempEl);
    tempChart.setOption({
        backgroundColor: 'transparent',
        textStyle: { color: '#ffffff' },
        tooltip: makeTooltip('°C'),
        xAxis: commonAxis,
        yAxis: commonYAxisTemp,
        series: [{
            type: 'bar',
            data: tempValues,
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#f59e0b' },
                    { offset: 1, color: '#b45309' }
                ])
            }
        }]
    });

    // Make charts responsive
    window.addEventListener('resize', () => {
        batteryChart.resize();
        loadChart.resize();
        tempChart.resize();
    });
}

// Update charts with new data
function updateCharts() {
    updateTimelineCharts();
}

// Set timeline range (1, 2, 7 days) and refresh charts
function setTimelineRange(days) {
    currentTimelineRangeDays = days;

    // Update button styling
    const rangeButtons = document.querySelectorAll('button[onclick^="setTimelineRange"]');
    rangeButtons.forEach((btn) => {
        btn.className = btn.className.replace('bg-blue-600', 'bg-gray-600');
    });
    const activeButton = document.querySelector(`button[onclick="setTimelineRange(${days})"]`);
    if (activeButton) {
        activeButton.className = activeButton.className.replace('bg-gray-600', 'bg-blue-600');
    }

    updateTimelineCharts();
}

let batteryTimelineChart;
let loadTimelineChart;
let tempTimelineChart;

function initializeTimelineCharts() {
    const batteryEl = document.getElementById('batteryPerformanceChart');
    const loadEl = document.getElementById('loadPerformanceChart');
    const tempEl = document.getElementById('tempPerformanceChart');

    if (!batteryEl || !loadEl || !tempEl) return;

    batteryTimelineChart = echarts.init(batteryEl);
    loadTimelineChart = echarts.init(loadEl);
    tempTimelineChart = echarts.init(tempEl);

    updateTimelineCharts();

    window.addEventListener('resize', () => {
        batteryTimelineChart && batteryTimelineChart.resize();
        loadTimelineChart && loadTimelineChart.resize();
        tempTimelineChart && tempTimelineChart.resize();
    });
}

async function updateTimelineCharts() {
    if (!batteryTimelineChart || !loadTimelineChart || !tempTimelineChart) return;

    try {
        const res = await fetch(`/api/ups/history?range=${currentTimelineRangeDays}`);
        if (!res.ok) throw new Error('Bad status');
        const points = await res.json();

        // Group by UPS name
        const byName = {};
        points.forEach((p) => {
            const name = p.name || p.id || 'UPS';
            if (!byName[name]) {
                byName[name] = {
                    battery: [],
                    load: [],
                    temperature: []
                };
            }
            const time = p.timestamp;
            if (typeof p.battery === 'number') {
                byName[name].battery.push([time, p.battery]);
            }
            if (typeof p.load === 'number') {
                byName[name].load.push([time, p.load]);
            }
            if (typeof p.temperature === 'number') {
                byName[name].temperature.push([time, p.temperature]);
            }
        });

        const batterySeries = [];
        const loadSeries = [];
        const tempSeries = [];

        Object.keys(byName).forEach((name) => {
            const seriesData = byName[name];
            // Sort by time
            seriesData.battery.sort((a, b) => a[0] - b[0]);
            seriesData.load.sort((a, b) => a[0] - b[0]);
            seriesData.temperature.sort((a, b) => a[0] - b[0]);

            if (seriesData.battery.length) {
                batterySeries.push({
                    name,
                    type: 'line',
                    showSymbol: false,
                    data: seriesData.battery
                });
            }
            if (seriesData.load.length) {
                loadSeries.push({
                    name,
                    type: 'line',
                    showSymbol: false,
                    data: seriesData.load
                });
            }
            if (seriesData.temperature.length) {
                tempSeries.push({
                    name,
                    type: 'line',
                    showSymbol: false,
                    data: seriesData.temperature
                });
            }
        });

        function makeTimelineOption(unit, series) {
            return {
                backgroundColor: 'transparent',
                textStyle: { color: '#ffffff' },
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    borderColor: '#00d4ff',
                    textStyle: { color: '#ffffff' },
                    formatter: function (params) {
                        const p = Array.isArray(params) ? params[0] : params;
                        return `${p.seriesName}: ${p.value[1]}${unit}`;
                    }
                },
                xAxis: {
                    type: 'time',
                    axisLabel: { color: '#ffffff' },
                    axisLine: { lineStyle: { color: '#374151' } }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        color: '#ffffff',
                        formatter: `{value}${unit}`
                    },
                    axisLine: { lineStyle: { color: '#374151' } },
                    splitLine: { lineStyle: { color: '#374151' } }
                },
                legend: {
                    show: true,
                    textStyle: { color: '#ffffff' }
                },
                series
            };
        }

        batteryTimelineChart.setOption(makeTimelineOption('%', batterySeries), true);
        loadTimelineChart.setOption(makeTimelineOption('%', loadSeries), true);
        tempTimelineChart.setOption(makeTimelineOption('°C', tempSeries), true);
    } catch (e) {
        console.warn('Failed to update timeline charts', e);
    }
}

// Initialize animations
function initializeAnimations() {
    // Animate hero text
    if (typeof anime !== 'undefined') {
        // Removed hero text animation as hero section is removed
        
        // Animate stats cards
        anime({
            targets: '#upsGrid .device-item', // Target the new UPS list items
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(100, {start: 500}),
            duration: 600,
            easing: 'easeOutQuart'
        });
        // Animate performance charts
        anime({
            targets: '.echarts-for-react', // Assuming ECharts renders to a div with this class or similar
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(100, {start: 800}),
            duration: 600,
            easing: 'easeOutQuart'
        });
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});

// --- Mobile Page Logic ---

async function initializeMobilePage() {
    await populateMobileDeviceList();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleMobileSearch);
    }
}

async function populateMobileDeviceList() {
    const deviceList = document.getElementById('deviceList');
    if (!deviceList) return;


    const devices = await fetchUPSData();
    deviceList.innerHTML = ''; // Clear existing

    devices.forEach(device => {
        const deviceItem = createMobileDeviceItem(device);
        deviceList.appendChild(deviceItem);
    });
}

function createMobileDeviceItem(ups) {
    const item = document.createElement('div');
    item.className = `device-item glass rounded-lg p-3 grid grid-cols-12 gap-2 items-center text-sm`;
    item.dataset.name = ups.name;

    const statusColor = getStatusColor(ups.status);

    item.innerHTML = `
        <div class="col-span-4">
            <a href="performance.html?upsId=${ups.id}" class="font-bold hover:text-blue-400 transition-colors truncate">${ups.name}</a>
        </div>
        <div class="col-span-3 flex items-center space-x-2">
            <div class="w-2.5 h-2.5 ${statusColor} rounded-full"></div>
            <span class="capitalize">${ups.status}</span>
        </div>
        <div class="col-span-2 text-center font-semibold">${ups.battery}%</div>
        <div class="col-span-2 text-center font-semibold">${ups.load}%</div>
        <div class="col-span-1 text-center font-semibold">${ups.temperature}°C</div>
    `;

    return item;
}

function handleMobileSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const items = document.querySelectorAll('.device-item');
    items.forEach(item => {
        const name = item.dataset.name.toLowerCase();
        item.style.display = name.includes(searchTerm) ? '' : 'none';
    });
}