
        let currentSort = { col: 'date', asc: false };
        let currentData = [];
        let priceChart = null;

        // Global refs needed by code outside DOMContentLoaded
        const queryInput = document.getElementById('query');

        document.addEventListener('DOMContentLoaded', () => {
            // Theme Toggle Logic
            const themeBtn = document.getElementById('theme-toggle');
            const themeIcon = document.getElementById('theme-icon');

            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                document.body.classList.add('theme-light');
                if (themeIcon) themeIcon.textContent = '🌙';
            }

            if (themeBtn) {
                themeBtn.addEventListener('click', () => {
                    const body = document.body;
                    body.classList.toggle('theme-light');
                    const isLight = body.classList.contains('theme-light');
                    themeIcon.textContent = isLight ? '🌙' : '🔆';
                    localStorage.setItem('theme', isLight ? 'light' : 'dark');
                });
            }

            // Top Bar Logic




            // DOM Elements
            const form = document.getElementById('search-form');
            const modeRadios = document.querySelectorAll('input[name="mode"]');
            const datePickers = document.getElementById('date-pickers');
            const startInput = document.getElementById('start-date');
            const endInput = document.getElementById('end-date');
            const btnExport = document.getElementById('btn-export');
            const btnFetch = document.getElementById('search-btn');
            const resolvedHelper = document.getElementById('resolved-helper');

            // Sort State
            let currentMode = 'latest';

            // Initialize Default Dates (last 30 days)
            const today = new Date();
            const lastMonth = new Date(today);
            lastMonth.setDate(lastMonth.getDate() - 30);
            endInput.value = today.toISOString().split('T')[0];
            startInput.value = lastMonth.toISOString().split('T')[0];

            function updateMarketStatus() {
                const now = new Date();
                const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

                // Clock
                const hh = String(ist.getHours()).padStart(2, '0');
                const mm = String(ist.getMinutes()).padStart(2, '0');
                const ss = String(ist.getSeconds()).padStart(2, '0');
                const clockEl = document.getElementById('ist-clock');
                if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`;

                // Market status
                const h = ist.getHours(), m = ist.getMinutes(), day = ist.getDay();
                const isOpen = day >= 1 && day <= 5
                    && (h > 9 || (h === 9 && m >= 15))
                    && !(h > 15 || (h === 15 && m >= 30));

                const badge = document.getElementById('market-badge');
                const label = document.getElementById('market-label');
                if (badge && label) {
                    badge.className = 'market-badge' + (isOpen ? '' : ' closed');
                    label.textContent = isOpen ? 'MARKET OPEN' : 'MARKET CLOSED';
                }
            }
            updateMarketStatus();
            setInterval(updateMarketStatus, 1000);

            // Input uppercase
            queryInput.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                e.target.value = e.target.value.toUpperCase();
                e.target.setSelectionRange(start, end);
                resolvedHelper.classList.add('stitch-hidden'); // hide resolution helper on typing
            });

            // Toggle mode
            function setMode(mode) {
                currentMode = mode;
                const latestRadio = document.getElementById('mode-latest');
                const historyRadio = document.getElementById('mode-history');
                if (mode === 'latest') latestRadio.checked = true;
                if (mode === 'history') historyRadio.checked = true;

                if (datePickers) {
                    if (mode === 'history') {
                        datePickers.classList.remove('stitch-hidden');
                    } else {
                        datePickers.classList.add('stitch-hidden');
                    }
                }
            }

            modeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    setMode(e.target.value);
                });
            });
            setMode('latest');


            // Handle Form Submit
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                handleFetch();
            });

            // Also support Enter key in input
            queryInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // prevent double fire from form
                    handleFetch();
                }
            });

            async function handleFetch() {
                const rawInput = queryInput.value.trim();
                const mode = currentMode;
                const start = startInput.value;
                const end = endInput.value;

                if (!rawInput) return;

                // Kick off the API fetch immediately
                const fetchPromise = fetchData(rawInput, mode, start, end);

                // Run the vanish animation concurrently
                await vanishAndSubmit(queryInput, document.getElementById('particle-canvas'), () => {
                    queryInput.value = '';
                    showPlaceholder();
                    checkInputLengthForButton();
                });

                await fetchPromise;
            }


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
                    if (currentSort.col === col) {
                        currentSort.asc = !currentSort.asc; // toggle
                    } else {
                        currentSort.col = col;
                        currentSort.asc = (col !== 'date'); // Default false for date, true for numbers
                    }
                    renderTable(currentData);
                });
            });

            queryInput.focus();
        });

        // --- API & State Management ---

        async function fetchData(rawInput, mode, start = '', end = '') {
            const btn = document.getElementById('search-btn');
            const content = document.getElementById('dashboard-content');
            const tableWrapper = document.getElementById('table-wrapper');
            const emptyState = document.getElementById('empty-state');
            const skeleton = document.getElementById('skeleton-loader');
            const resolvedHelper = document.getElementById('resolved-helper');
            const bar = document.getElementById('loading-bar');

            btn.innerHTML = 'FETCHING...';
            btn.disabled = true;
            if (bar) bar.classList.add('active');

            document.getElementById('summary-cards').classList.remove('stitch-hidden');
            tableWrapper.classList.add('stitch-hidden');
            emptyState.classList.add('stitch-hidden');
            skeleton.classList.remove('stitch-hidden');
            hideNewsSection();

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

                    if (!resolveRes.ok) throw new Error(resolveJson.detail || resolveJson.error || 'Failed to resolve company.');

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
                    dataArray = [{ ...json, Date: json.date, Open: json.open, High: json.high, Low: json.low, Close: json.close, Volume: json.volume }];
                } else {
                    if (!start || !end) {
                        showToast('Start and End dates are required for history.', 'warning');
                        throw new Error('Dates required');
                    }
                    const res = await fetch(`/api/stock/history?ticker=${encodeURIComponent(ticker)}&start=${start}&end=${end}`);
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.detail || json.error || 'Failed Historical fetch.');
                    if (json.length === 0) throw new Error('No Data Found');
                    dataArray = json; // yfinance chronological
                }

                currentData = dataArray;
                document.getElementById('table-ticker-badge').textContent = `[ ${ticker} ]`;

                // Populate Summary
                const latest = dataArray[dataArray.length - 1]; // last item is most recent conceptually
                document.getElementById('val-open').textContent = fmtCurrency(latest.Open);
                document.getElementById('val-close').textContent = fmtCurrency(latest.Close);

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
                drawChart(ticker, dataArray);

                const now = new Date();
                document.getElementById('last-updated').textContent = `Local time: ${now.toLocaleTimeString('en-US')}`;

                if (!isHistory || dataArray.length > 0) showToast('Data fetched successfully', 'success');

            } catch (err) {
                if (err.message !== 'Dates required') showToast(err.message, 'error');
                if (currentData.length === 0) {
                    document.getElementById('summary-cards').classList.add('stitch-hidden');
                    document.querySelector('.chart-section').classList.add('stitch-hidden');
                    emptyState.classList.remove('stitch-hidden');
                    hideNewsSection();
                }
            } finally {
                skeleton.classList.add('stitch-hidden');
                if (bar) bar.classList.remove('active');

                btn.innerHTML = 'FETCH DATA →';
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
            if (th) {
                th.querySelector('.sort-icon').textContent = currentSort.asc ? '↑' : '↓';
            }

            // Sort data copy
            let sorted = [...dataArray].sort((a, b) => {
                let valA, valB;
                if (currentSort.col === 'date') {
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

        function drawChart(ticker, dataArray) {
            if (!dataArray || dataArray.length === 0) return;

            const chartCanvas = document.getElementById('price-chart');
            if (!chartCanvas) return;

            // Show chart section
            document.querySelector('.chart-section').classList.remove('stitch-hidden');

            const ctx = chartCanvas.getContext('2d');
            if (priceChart) { priceChart.destroy(); priceChart = null; }

            const dates = dataArray.map(d => new Date(d.Date));
            const closes = dataArray.map(d => d.Close);
            const isUp = closes[closes.length - 1] >= closes[0];
            const color = isUp ? '#00c896' : '#f43f5e';
            const fill = isUp ? 'rgba(0,200,150,0.08)' : 'rgba(244,63,94,0.08)';

            priceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: ticker,
                        data: closes,
                        borderColor: color,
                        backgroundColor: fill,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        fill: true,
                        tension: 0.1
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
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            titleColor: '#888',
                            bodyColor: '#fff',
                            borderColor: '#333',
                            borderWidth: 1,
                            callbacks: {
                                label: function (context) {
                                    return '₹' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: { tooltipFormat: 'dd MMM yyyy' },
                            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                            ticks: { color: '#5b7aa0', maxRotation: 0 }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                            ticks: {
                                color: '#5b7aa0',
                                callback: function (value) { return '₹' + value; }
                            }
                        }
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });

            // Wire: Call News fetcher alongside drawChart
            fetchNews(ticker);
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
            if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
            return num.toString();
        };
        const fmtMarketCap = (num) => {
            if (num == null) return '--';
            if (num >= 10000000000000) return '₹' + (num / 10000000000000).toFixed(2) + 'T';
            if (num >= 1000000000) return '₹' + (num / 1000000000).toFixed(2) + 'B';
            if (num >= 1000000) return '₹' + (num / 1000000).toFixed(2) + 'M';
            return '₹' + num.toString();
        };

        // -- Placeholder Engine --
        const PLACEHOLDERS = [
            'Search "Reliance" or RELIANCE.NS',
            'Search "TCS" or TCS.NS',
            'Search "HDFC Bank" or HDFCBANK.NS',
            'Search "Infosys" or INFY.NS',
            'Try WIPRO, BAJFINANCE, ITC…',
            'Enter company name or symbol',
        ];

        let phIndex = 0;
        const phEl = document.getElementById('rotating-placeholder');
        if (phEl) phEl.textContent = PLACEHOLDERS[0];

        function cyclePlaceholder() {
            if (!phEl) return;
            phEl.classList.remove('ph-enter');
            phEl.classList.add('ph-exit');
            setTimeout(() => {
                phIndex = (phIndex + 1) % PLACEHOLDERS.length;
                phEl.textContent = PLACEHOLDERS[phIndex];
                phEl.classList.remove('ph-exit');
                phEl.classList.add('ph-enter');
            }, 280);
        }
        setInterval(cyclePlaceholder, 3200);

        function checkInputLengthForButton() {
            const btn = document.getElementById('search-btn');
            if (queryInput && queryInput.value.trim().length > 0) {
                if (btn) btn.disabled = false;
            } else {
                if (btn) btn.disabled = true;
            }
        }
        checkInputLengthForButton();

        queryInput.addEventListener('input', () => {
            if (phEl) {
                phEl.style.display = queryInput.value ? 'none' : '';
                checkInputLengthForButton();
            }
        });

        function showPlaceholder() {
            if (phEl) phEl.style.display = '';
        }

        // --- Vanish Animation ---
        async function vanishAndSubmit(inputEl, canvasEl, onComplete) {
            const ctx = canvasEl.getContext('2d');

            canvasEl.width = inputEl.offsetWidth * 2;
            canvasEl.height = inputEl.offsetHeight * 2;
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

            const cs = getComputedStyle(inputEl);
            const fs = parseFloat(cs.fontSize) * 2;
            ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
            ctx.fillStyle = '#ffffff';

            // Try to match exact drawing position. The input text starts around '36px' padding.
            ctx.fillText(inputEl.value, 72, fs + 6);

            const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
            const d = imgData.data;
            const particles = [];
            for (let y = 0; y < canvasEl.height; y++) {
                for (let x = 0; x < canvasEl.width; x++) {
                    const i = (y * canvasEl.width + x) * 4;
                    if (d[i + 3] > 128) {
                        particles.push({
                            x, y, r: 1,
                            color: `rgba(${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3] / 255})`
                        });
                    }
                }
            }

            canvasEl.style.opacity = '1';
            inputEl.style.color = 'transparent';
            inputEl.disabled = true;

            let pos = particles.reduce((m, p) => Math.max(m, p.x), 0);
            let alive = [...particles];

            await new Promise(resolve => {
                if (alive.length === 0) {
                    canvasEl.style.opacity = '0';
                    inputEl.style.color = '';
                    inputEl.disabled = false;
                    resolve();
                    return;
                }
                (function frame() {
                    requestAnimationFrame(() => {
                        ctx.clearRect(pos - 10, 0, canvasEl.width, canvasEl.height);
                        const next = [];
                        for (const p of alive) {
                            if (p.x < pos) { next.push(p); continue; }
                            if (p.r <= 0) continue;
                            p.x += Math.random() > .5 ? 1 : -1;
                            p.y += Math.random() > .5 ? 1 : -1;
                            p.r -= 0.05 * Math.random();
                            if (p.x > pos) {
                                ctx.beginPath();
                                ctx.rect(p.x, p.y, p.r, p.r);
                                ctx.fillStyle = p.color;
                                ctx.fill();
                            }
                            next.push(p);
                        }
                        alive = next;
                        pos -= 8;
                        if (alive.length > 0) frame();
                        else {
                            canvasEl.style.opacity = '0';
                            inputEl.style.color = '';
                            inputEl.disabled = false;
                            resolve();
                        }
                    });
                })();
            });

            onComplete();
        }

        /* ── News + Sentiment ──────────────────────────────────── */

        async function fetchNews(ticker) {
            const section = document.getElementById('news-section');
            const container = document.getElementById('headlines-container');

            if (!section) return;

            // Show section with skeleton loaders
            section.classList.add('visible');
            container.innerHTML = `
    <div class="news-skeleton"></div>
    <div class="news-skeleton"></div>
    <div class="news-skeleton"></div>
  `;

            try {
                const res = await fetch(`/api/stock/news?ticker=${encodeURIComponent(ticker)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                renderNews(data);
            } catch (err) {
                container.innerHTML = `
      <div style="font-family:var(--mono);font-size:.8rem;color:var(--red);padding:.75rem;">
        Could not load news. Please try again.
      </div>`;
            }
        }

        function renderNews(data) {
            const signal = data.signal;   // "BULLISH" | "BEARISH" | "NEUTRAL"
            const pct = data.bullish_pct;
            const count = data.headline_count;
            const bd = data.breakdown;

            // Signal banner
            const banner = document.getElementById('signal-banner');
            const label = document.getElementById('signal-label');
            const arrow = document.getElementById('signal-arrow');
            const text = document.getElementById('signal-text');
            const meta = document.getElementById('signal-meta');
            const fill = document.getElementById('sentiment-fill');
            const pctEl = document.getElementById('sentiment-pct');

            banner.className = `signal-banner ${signal}`;
            label.className = `signal-label ${signal}`;
            fill.className = `sentiment-fill ${signal}`;
            arrow.textContent = signal === 'BULLISH' ? '▲' : signal === 'BEARISH' ? '▼' : '→';
            text.textContent = signal;
            meta.textContent = `Based on ${count} headline${count !== 1 ? 's' : ''} · Google News · NSE`;
            fill.style.width = pct + '%';
            pctEl.textContent = pct + '%';

            // Breakdown
            document.getElementById('bd-bullish').textContent = bd.bullish;
            document.getElementById('bd-bearish').textContent = bd.bearish;
            document.getElementById('bd-neutral').textContent = bd.neutral;

            // Headlines
            const container = document.getElementById('headlines-container');
            if (!data.headlines || data.headlines.length === 0) {
                container.innerHTML = `
      <div style="font-family:var(--mono);font-size:.8rem;color:var(--text-muted);padding:.75rem;">
        No headlines found for this ticker.
      </div>`;
                return;
            }

            container.innerHTML = data.headlines.map(h => {
                const time = formatNewsTime(h.published);
                return `
      <a class="headline-card ${h.sentiment}"
         href="${escHtml(h.url)}" target="_blank" rel="noopener noreferrer">
        <div class="headline-left">
          <div class="headline-title">${escHtml(h.title)}</div>
          <div class="headline-meta">
            <span>${escHtml(h.source)}</span>
            <span>${time}</span>
          </div>
        </div>
        <div class="headline-right">
          <span class="sentiment-pill ${h.sentiment}">${h.sentiment}</span>
        </div>
      </a>`;
            }).join('');
        }

        function formatNewsTime(pubDateStr) {
            if (!pubDateStr) return '';
            try {
                const d = new Date(pubDateStr);
                const now = new Date();
                const diff = Math.floor((now - d) / 60000); // minutes
                if (diff < 60) return `${diff}m ago`;
                if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
                return `${Math.floor(diff / 1440)}d ago`;
            } catch { return ''; }
        }

        function escHtml(str) {
            const d = document.createElement('div');
            d.textContent = str || '';
            return d.innerHTML;
        }

        function hideNewsSection() {
            const section = document.getElementById('news-section');
            if (section) section.classList.remove('visible');
        }

    