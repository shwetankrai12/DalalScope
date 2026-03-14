let currentSort = { col: 'date', asc: false };
let currentData = [];

document.addEventListener('DOMContentLoaded', () => {
    // Top Bar Logic
    initClock();
    updateMarketStatus();
    setInterval(updateMarketStatus, 1000); // Check every second for both clock and market status

    // DOM Elements
    const form = document.getElementById('search-form');
    const queryInput = document.getElementById('query');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const datePickers = document.getElementById('date-pickers');
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    const btnExport = document.getElementById('btn-export');
    const btnFetch = document.getElementById('btn-fetch');
    const resolvedHelper = document.getElementById('resolved-helper');
    
    // Sort State
    // (moved to global scope)
    // Initialize Default Dates (last 30 days)
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);
    endInput.value = today.toISOString().split('T')[0];
    startInput.value = lastMonth.toISOString().split('T')[0];

    // Input uppercase
    queryInput.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);
        resolvedHelper.classList.add('stitch-hidden'); // hide resolution helper on typing
    });

    // Toggle mode
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'history') {
                datePickers.classList.remove('stitch-hidden');
            } else {
                datePickers.classList.add('stitch-hidden');
            }
        });
    });

    // Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawInput = queryInput.value.trim();
        const mode = document.querySelector('input[name="mode"]:checked').value;
        const start = startInput.value;
        const end = endInput.value;

        if(!rawInput) return;

        await fetchData(rawInput, mode, start, end);
    });

    // Handle Export
    btnExport.addEventListener('click', () => {
        if (!currentData.length) return;
        const ticker = document.getElementById('table-ticker-badge').textContent.replace(/[\[\]\s]/g, '');
        downloadCSV(currentData, ticker);
    });

    // Handle Table Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if(currentSort.col === col) {
                currentSort.asc = !currentSort.asc; // toggle
            } else {
                currentSort.col = col;
                currentSort.asc = (col !== 'date'); // Default false for date, true for numbers
            }
            renderTable(currentData);
        });
    });

    // Pre-fetch TCS.NS on load
    queryInput.value = 'TCS.NS';
    fetchData('TCS.NS', 'latest');
});

// --- Top Bar & Status ---

function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    const now = new Date();
    const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
    clockEl.textContent = `IST ${timeStr.toUpperCase()}`;
}

function updateMarketStatus() {
    const statusText = document.querySelector('.status-text');
    const badge = document.getElementById('market-status');
    const now = new Date();
    
    // Get IST time parts
    const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    
    let h = 0, m = 0, wd = '';
    parts.forEach(p => {
        if(p.type === 'hour') h = parseInt(p.value);
        if(p.type === 'minute') m = parseInt(p.value);
        if(p.type === 'weekday') wd = p.value;
    });

    const mins = h * 60 + m;
    const isWeekend = (wd === 'Sat' || wd === 'Sun');
    // NSE: 9:15 AM (555) to 3:30 PM (930)
    const isOpen = !isWeekend && (mins >= 555 && mins <= 930);

    if (isOpen) {
        statusText.textContent = "LIVE • NSE OPEN";
        badge.className = "status-badge open";
    } else {
        statusText.textContent = "NSE CLOSED";
        badge.className = "status-badge closed";
    }
}


// --- API & State Management ---

async function fetchData(rawInput, mode, start='', end='') {
    const btn = document.getElementById('btn-fetch');
    const content = document.getElementById('dashboard-content');
    const tableWrapper = document.getElementById('table-wrapper');
    const emptyState = document.getElementById('empty-state');
    const skeleton = document.getElementById('skeleton-loader');
    const resolvedHelper = document.getElementById('resolved-helper');

    btn.textContent = 'FETCHING...';
    btn.disabled = true;
    content.classList.remove('stitch-hidden'); // Show content area to reveal skeleton
    tableWrapper.classList.add('stitch-hidden');
    emptyState.classList.add('stitch-hidden');
    skeleton.classList.remove('stitch-hidden');
    
    // reset summaries
    document.getElementById('val-open').textContent = '--';
    document.getElementById('val-close').textContent = '--';
    document.getElementById('val-range').textContent = '--';
    document.getElementById('val-volume').textContent = '--';
    document.getElementById('val-change').textContent = '--';
    document.getElementById('val-change').className = 'change-badge stitch-hidden';
    document.getElementById('close-bar').className = 'card-bar';

    try {
        let ticker = rawInput.toUpperCase();
        let companyName = null;

        // Auto append .NS
        if (!ticker.endsWith('.NS') && !ticker.includes(' ')) {
            ticker += '.NS';
            document.getElementById('query').value = ticker;
        }

        // Resolve if it looks like a company name
        if (ticker.includes(' ')) {
            const resolveURL = `/api/stock/resolve?company=${encodeURIComponent(rawInput)}`;
            const resolveRes = await fetch(resolveURL);
            const resolveJson = await resolveRes.json();
            
            if(!resolveRes.ok) throw new Error(resolveJson.detail || resolveJson.error || 'Failed to resolve company.');
            
            ticker = resolveJson.ticker;
            companyName = resolveJson.company;
            document.getElementById('query').value = ticker;
            
            resolvedHelper.textContent = `Resolved: ${companyName}`;
            resolvedHelper.classList.remove('stitch-hidden');
        }

        let isHistory = (mode === 'history');
        let dataArray = [];

        if (!isHistory) {
            const res = await fetch(`/api/stock/latest?ticker=${encodeURIComponent(ticker)}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || json.error || 'Failed to fetch latest data.');
            dataArray = [{...json, Date: json.date, Open: json.open, High: json.high, Low: json.low, Close: json.close, Volume: json.volume}];
        } else {
            if(!start || !end) {
                showToast('Start and End dates are required for history.', 'warning');
                throw new Error('Dates required');
            }
            const res = await fetch(`/api/stock/history?ticker=${encodeURIComponent(ticker)}&start=${start}&end=${end}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || json.error || 'Failed Historical fetch.');
            if(json.length === 0) throw new Error('No Data Found');
            dataArray = json; // yfinance chronological
        }

        currentData = dataArray;
        document.getElementById('table-ticker-badge').textContent = `[ ${ticker} ]`;
        
        // Populate Summary
        const latest = dataArray[dataArray.length - 1]; // last item is most recent conceptually
        animateValue(document.getElementById('val-open'), latest.Open, true);
        animateValue(document.getElementById('val-close'), latest.Close, true);
        
        document.getElementById('val-range').textContent = `${latest.Low.toFixed(2)} — ${latest.High.toFixed(2)}`;
        document.getElementById('val-volume').textContent = fmtVolume(latest.Volume);

        const change = latest.Close - latest.Open;
        const pctChange = (change / latest.Open) * 100;
        const changeBadge = document.getElementById('val-change');
        const closeBar = document.getElementById('close-bar');
        
        if (change > 0) {
            changeBadge.innerHTML = `▲ +${pctChange.toFixed(2)}%`;
            changeBadge.className = 'change-badge badge-pos';
            closeBar.className = 'card-bar positive';
        } else if (change < 0) {
            changeBadge.innerHTML = `▼ ${pctChange.toFixed(2)}%`;
            changeBadge.className = 'change-badge badge-neg';
            closeBar.className = 'card-bar negative';
        } else {
            changeBadge.innerHTML = `0.00%`;
            changeBadge.className = 'change-badge';
            closeBar.className = 'card-bar';
        }

        // Render Table or empty state
        if (isHistory && dataArray.length > 0) {
            document.getElementById('btn-export').disabled = false;
            currentSort = { col: 'date', asc: false }; // Reset sort
            renderTable(dataArray);
            tableWrapper.classList.remove('stitch-hidden');
        } else if (isHistory) {
            emptyState.classList.remove('stitch-hidden');
            document.getElementById('btn-export').disabled = true;
        } else {
            // Latest mode, hide table
            document.getElementById('btn-export').disabled = true;
        }
        
        // Draw Chart
        drawChart(dataArray, ticker);

        const now = new Date();
        document.getElementById('last-updated').textContent = `Local time: ${now.toLocaleTimeString('en-US')}`;
        
        if(!isHistory || dataArray.length > 0) showToast('Data fetched successfully', 'success');

    } catch(err) {
        if(err.message !== 'Dates required') showToast(err.message, 'error');
        if(currentData.length === 0) {
            content.classList.add('stitch-hidden');
        }
    } finally {
        skeleton.classList.add('stitch-hidden');
        btn.textContent = 'FETCH DATA ▶';
        btn.disabled = false;
        
        // Re-trigger stagger animation
        const staggers = document.querySelectorAll('.fade-in-stagger');
        staggers.forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = null;
        });
    }
}


// --- UI Renderers & Animation ---

let priceChart = null;

function renderTable(dataArray) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    // Update sort icons
    document.querySelectorAll('th[data-sort] .sort-icon').forEach(icon => icon.textContent = '');
    const th = document.querySelector(`th[data-sort="${currentSort.col}"]`);
    if(th) {
        th.querySelector('.sort-icon').textContent = currentSort.asc ? '↑' : '↓';
    }

    // Sort data copy
    let sorted = [...dataArray].sort((a, b) => {
        let valA, valB;
        if(currentSort.col === 'date') {
            valA = new Date(a.Date).getTime();
            valB = new Date(b.Date).getTime();
        } else {
            const keyMap = { 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume' };
            valA = a[keyMap[currentSort.col]];
            valB = b[keyMap[currentSort.col]];
        }
        
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });

    sorted.forEach((row, i) => {
        const change = row.Close - row.Open;
        const trend = change >= 0 ? 'pos' : 'neg';
        
        const tr = document.createElement('tr');
        tr.style.animationDelay = `${i * 30}ms`; // staggered row fade in
        
        tr.innerHTML = `
            <td>
                <span class="row-indicator ${trend}"></span>
                ${fmtDate(row.Date)}
            </td>
            <td>${fmtCurrency(row.Open)}</td>
            <td>${fmtCurrency(row.High)}</td>
            <td>${fmtCurrency(row.Low)}</td>
            <td class="highlight-td">${fmtCurrency(row.Close)}</td>
            <td>${fmtVolume(row.Volume)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function drawChart(dataArray, ticker) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    const isHistory = dataArray.length > 1;
    
    // Show chart container only if history
    const chartSection = document.querySelector('.chart-section');
    if (!isHistory) {
        chartSection.classList.add('stitch-hidden');
        return;
    } else {
        chartSection.classList.remove('stitch-hidden');
    }

    // Prepare data
    const labels = dataArray.map(d => fmtDate(d.Date));
    const dataPoints = dataArray.map(d => d.Close);
    
    // Determine overall trend color
    const firstClose = dataArray[0].Close;
    const lastClose = dataArray[dataArray.length - 1].Close;
    const isPositive = lastClose >= firstClose;
    
    const lineColor = isPositive ? '#00FF88' : '#FF3B5C';
    const bgColor = isPositive ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 59, 92, 0.1)';

    if (priceChart) {
        priceChart.destroy();
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${ticker} Close Price`,
                data: dataPoints,
                borderColor: lineColor,
                backgroundColor: bgColor,
                borderWidth: 2,
                pointRadius: 0, // hide points unless hovered
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#00D4FF',
                fill: true,
                tension: 0.1 // sharp jagged lines for terminal feel
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 22, 35, 0.9)',
                    titleColor: '#8899AA',
                    bodyColor: '#E8EDF5',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: "'IBM Plex Mono', monospace" },
                    bodyFont: { family: "'IBM Plex Mono', monospace", size: 14 }
                }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: '#8899AA', font: { family: "'IBM Plex Mono', monospace", size: 10 }, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { 
                        color: '#8899AA', 
                        font: { family: "'IBM Plex Mono', monospace", size: 11 },
                        callback: function(value) { return '₹' + value; }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

// Formatters
const fmtCurrency = (val) => val != null ? `₹${Number(val).toFixed(2)}` : '--';
const fmtDate = (dateStr) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
};
const fmtVolume = (num) => {
    if (num == null) return '--';
    if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Number(num).toString();
};

function animateValue(obj, end, isCurrency=false, duration=600) {
    if(!end || isNaN(end)) {
        obj.textContent = '--';
        return;
    }
    let startTimestamp = null;
    let startVal = parseFloat(obj.textContent.replace(/[^0-9.-]+/g,""));
    if(isNaN(startVal)) startVal = end * 0.9; // Arbitrary start if none

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = startVal + (end - startVal) * ease;
        
        obj.textContent = isCurrency ? fmtCurrency(current) : current.toFixed(2);
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = isCurrency ? fmtCurrency(end) : end;
        }
    };
    window.requestAnimationFrame(step);
}

// --- Toasts & Exports ---

function showToast(msg, type='error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `stitch-toast toast-${type}`;
    toast.textContent = msg;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

function downloadCSV(dataArray, ticker) {
    if(!dataArray || dataArray.length === 0) return;
    
    const headers = ["Date", "Open", "High", "Low", "Close", "Volume"];
    let csvContent = headers.join(",") + "\n";
    
    dataArray.forEach(row => {
        const line = [row.Date, row.Open, row.High, row.Low, row.Close, row.Volume].join(",");
        csvContent += line + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${ticker}_history.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
