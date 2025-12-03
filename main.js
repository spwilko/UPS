// APC UPS Monitoring System - Main JavaScript

// Global variables
let autoRefreshInterval;
let autoRefreshEnabled = true;
let upsData = [];
let currentFilter = 'all';
let currentTimelineRangeDays = 1;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    initializeApp();
    upsData = await fetchUPSData();
    updateDashboardStats();
    renderUPSGrid();
    initializeCharts();
    startAutoRefresh();
    initializeAnimations();
});

// Initialize application
function initializeApp() {
    console.log('APC UPS Monitoring System initialized');
    
    // Set up search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
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

// Update top-of-dashboard quick stats based on current upsData
function updateDashboardStats() {
    const totalEl = document.getElementById('totalUpsCount');
    const onlineEl = document.getElementById('onlineUpsCount');
    const warningEl = document.getElementById('warningUpsCount');
    const criticalEl = document.getElementById('criticalUpsCount');

    if (!totalEl || !onlineEl || !warningEl || !criticalEl) return;

    const total = upsData.length;
    const online = upsData.filter(ups => ups.status === 'online').length;
    const warning = upsData.filter(ups => ups.status === 'warning').length;
    const critical = upsData.filter(ups => ups.status === 'critical').length;

    totalEl.textContent = total;
    onlineEl.textContent = online;
    warningEl.textContent = warning;
    criticalEl.textContent = critical;
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
        targets: '.ups-card',
        opacity: [0, 1],
        translateY: [20, 0],
        delay: anime.stagger(50),
        duration: 600,
        easing: 'easeOutQuart'
    });
}

// Create UPS card element
function createUPSCard(ups) {
    const card = document.createElement('div');
    card.className = `ups-card glass rounded-xl p-6 card-hover cursor-pointer border-l-4 ${getStatusBorderColor(ups.status)}`;
    card.onclick = () => showUPSDetail(ups);
    
    const statusColor = getStatusColor(ups.status);
    const batteryColor = getBatteryColor(ups.battery);
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h4 class="font-bold text-lg">${ups.name}</h4>
            <div class="flex items-center space-x-2">
                <div class="w-3 h-3 ${statusColor} rounded-full"></div>
                <span class="text-sm capitalize">${ups.status}</span>
            </div>
        </div>
        
        <div class="space-y-3">
            <div class="flex justify-between text-sm">
                <span class="text-gray-300">Battery:</span>
                <span class="font-medium">${ups.battery}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
                <div class="${batteryColor} h-2 rounded-full transition-all duration-500" style="width: ${ups.battery}%"></div>
            </div>
            
            <div class="flex justify-between text-sm">
                <span class="text-gray-300">Load:</span>
                <span class="font-medium">${ups.load}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
                <div class="bg-blue-500 h-2 rounded-full transition-all duration-500" style="width: ${ups.load}%"></div>
            </div>
            
            <div class="flex justify-between text-sm">
                <span class="text-gray-300">Temperature:</span>
                <span class="font-medium">${ups.temperature}°C</span>
            </div>
            
            <div class="flex justify-between text-sm">
                <span class="text-gray-300">Runtime:</span>
                <span class="font-medium mono">${Math.floor(ups.runtime / 60)}h ${ups.runtime % 60}m</span>
            </div>
            
            <div class="flex justify-between text-xs text-gray-400 mt-3">
                <span>IP: ${ups.ip}</span>
                <span>${ups.lastUpdate}</span>
            </div>
        </div>
    `;
    
    return card;
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
function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    const grid = document.getElementById('upsGrid');
    const cards = grid.querySelectorAll('.ups-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
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
        renderUPSGrid();
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
    initializeBatteryChart();
    initializeLoadChart();
    initializePerformanceCharts();
}

// Initialize timeline charts on first load
document.addEventListener('DOMContentLoaded', function() {
    // Slight delay to ensure layout is ready
    setTimeout(() => {
        initializeTimelineCharts();
    }, 500);
});

// Initialize battery chart
function initializeBatteryChart() {
    const chart = echarts.init(document.getElementById('batteryChart'));
    
    const option = {
        backgroundColor: 'transparent',
        textStyle: { color: '#ffffff' },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: '#00d4ff',
            textStyle: { color: '#ffffff' }
        },
        series: [{
            name: 'Battery Levels',
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '50%'],
            data: [
                { value: 15, name: 'Critical (< 30%)', itemStyle: { color: '#ef4444' } },
                { value: 25, name: 'Warning (30-60%)', itemStyle: { color: '#f59e0b' } },
                { value: 60, name: 'Good (> 60%)', itemStyle: { color: '#10b981' } }
            ],
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 212, 255, 0.5)'
                }
            },
            label: {
                color: '#ffffff'
            }
        }]
    };
    
    chart.setOption(option);
    
    // Make chart responsive
    window.addEventListener('resize', () => chart.resize());
}

// Initialize load chart
function initializeLoadChart() {
    const chart = echarts.init(document.getElementById('loadChart'));
    
    const option = {
        backgroundColor: 'transparent',
        textStyle: { color: '#ffffff' },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: '#00d4ff',
            textStyle: { color: '#ffffff' }
        },
        xAxis: {
            type: 'category',
            data: upsData.slice(0, 10).map(ups => ups.name),
            axisLabel: { color: '#ffffff' },
            axisLine: { lineStyle: { color: '#374151' } }
        },
        yAxis: {
            type: 'value',
            max: 100,
            axisLabel: { color: '#ffffff', formatter: '{value}%' },
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#374151' } }
        },
        series: [{
            name: 'Load %',
            type: 'bar',
            data: upsData.slice(0, 10).map(ups => ups.load),
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#00d4ff' },
                    { offset: 1, color: '#3b82f6' }
                ])
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 212, 255, 0.5)'
                }
            }
        }]
    };
    
    chart.setOption(option);
    
    // Make chart responsive
    window.addEventListener('resize', () => chart.resize());
}

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
    initializeBatteryChart();
    initializeLoadChart();
    initializePerformanceCharts();
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
        anime({
            targets: '[data-splitting] .char',
            opacity: [0, 1],
            translateY: [50, 0],
            delay: anime.stagger(50),
            duration: 800,
            easing: 'easeOutQuart'
        });
        
        // Animate stats cards
        anime({
            targets: '.card-hover',
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(100, {start: 500}),
            duration: 600,
            easing: 'easeOutQuart'
        });
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});