/**
 * portfolio.js — DalalScope Portfolio Tracker
 * Stores holdings in localStorage. Refreshes live prices via /api/portfolio/prices.
 * No external dependencies — uses the same CSS variables as index.html.
 */

// ── State ─────────────────────────────────────────────────────────────────────

/** @type {{ ticker: string, companyName: string, qty: number, avgBuyPrice: number }[]} */
let holdings = [];

/** @type {{ [ticker: string]: number | null }} */
let livePrices = {};

/** @type {{ [ticker: string]: number | null }} */
let prevPrices = {};

let isRefreshing = false;

// ── API Authentication ─────────────────────────────────────────────────────────

async function getAuthToken() {
    const { data: { session } } = await window.supabase.auth.getSession();
    return session?.access_token || null;
}

// ── State Management ──────────────────────────────────────────────────────────

async function loadHoldings() {
    const token = await getAuthToken();
    if (!token) { holdings = []; return; }
    
    try {
        const res = await fetch('/api/holdings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            console.error(`Holdings fetch failed: ${res.status}`);
            showPortfolioToast('Failed to load portfolio. Check your connection.', 'error');
            holdings = [];
            return;
        }
        holdings = await res.json();
        // normalize field names from snake_case to camelCase for the frontend
        holdings = holdings.map(h => ({
            ticker: h.ticker,
            companyName: h.company_name,
            qty: h.qty,
            avgBuyPrice: h.avg_buy_price
        }));
    } catch (err) {
        console.error("Failed to load holdings:", err);
        showPortfolioToast('Failed to load portfolio. Check your connection.', 'error');
        holdings = [];
    }
}

// ── Formatting ────────────────────────────────────────────────────────────────

const fmtINR = (n) =>
    n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n) =>
    n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

const fmtQty = (n) =>
    Number(n).toLocaleString('en-IN', { maximumFractionDigits: 4 });

// ── Calculations ──────────────────────────────────────────────────────────────

function calcHoldingStats(h) {
    const ltp = livePrices[h.ticker] ?? null;
    const invested = h.qty * h.avgBuyPrice;
    const currentVal = ltp != null ? h.qty * ltp : null;
    const pnl = currentVal != null ? currentVal - invested : null;
    const pnlPct = pnl != null && invested > 0 ? (pnl / invested) * 100 : null;
    return { ltp, invested, currentVal, pnl, pnlPct };
}

function calcPortfolioTotals() {
    let totalInvested = 0;
    let totalCurrent = 0;
    let hasLive = false;

    holdings.forEach(h => {
        const { invested, currentVal } = calcHoldingStats(h);
        totalInvested += invested;
        if (currentVal != null) {
            totalCurrent += currentVal;
            hasLive = true;
        } else {
            totalCurrent += invested; // fallback: treat as flat if no price
        }
    });

    const totalPnl = hasLive ? totalCurrent - totalInvested : null;
    const totalPnlPct = totalPnl != null && totalInvested > 0
        ? (totalPnl / totalInvested) * 100
        : null;

    return { totalInvested, totalCurrent, totalPnl, totalPnlPct };
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function refreshPrices() {
    if (!holdings.length || isRefreshing) return;
    isRefreshing = true;
    updateRefreshBtn(true);

    const tickers = holdings.map(h => h.ticker);
    try {
        const res = await fetch('/api/portfolio/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        // Save current prices as prev for flash animation
        prevPrices = { ...livePrices };
        livePrices = { ...livePrices, ...data };
        
        renderPortfolioTable();
        renderSummaryBar();
        showPortfolioToast('Prices refreshed', 'success');
    } catch (err) {
        showPortfolioToast('Could not refresh prices — check connection', 'error');
    } finally {
        isRefreshing = false;
        updateRefreshBtn(false);
    }
}

async function fetchQuoteForTicker(ticker) {
    const t = ticker.toUpperCase().endsWith('.NS') ? ticker.toUpperCase() : ticker.toUpperCase() + '.NS';
    const res = await fetch(`/api/portfolio/quote/${encodeURIComponent(t)}`);
    if (!res.ok) throw new Error(`Could not fetch quote for ${t}`);
    return res.json(); // { ticker, close, date }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderPortfolioTable() {
    const tbody = document.getElementById('pt-tbody');
    const emptyState = document.getElementById('pt-empty');
    const tableWrap = document.getElementById('pt-table-wrap');
    if (!tbody) return;

    if (!holdings.length) {
        emptyState?.classList.remove('pt-hidden');
        tableWrap?.classList.add('pt-hidden');
        return;
    }

    emptyState?.classList.add('pt-hidden');
    tableWrap?.classList.remove('pt-hidden');
    
    // Pre-calculate to find best/worst and total values
    const { totalCurrent, totalInvested } = calcPortfolioTotals();
    const effectiveTotal = totalCurrent > 0 ? totalCurrent : totalInvested;
    
    let bestIdx = -1;
    let worstIdx = -1;
    let maxPct = -Infinity;
    let minPct = Infinity;
    
    const holdingStats = holdings.map((h, idx) => {
        const stats = calcHoldingStats(h);
        if (stats.pnlPct != null) {
            if (stats.pnlPct > maxPct) { maxPct = stats.pnlPct; bestIdx = idx; }
            if (stats.pnlPct < minPct) { minPct = stats.pnlPct; worstIdx = idx; }
        }
        return stats;
    });

    tbody.innerHTML = holdings.map((h, idx) => {
        const { ltp, invested, currentVal, pnl, pnlPct } = holdingStats[idx];
        const posClass = pnl == null ? '' : pnl > 0 ? 'pt-pos' : pnl < 0 ? 'pt-neg' : '';
        const rowClass = pnl == null ? '' : pnl > 0 ? 'pt-row-pos' : pnl < 0 ? 'pt-row-neg' : '';
        
        const oldLtp = prevPrices[h.ticker];
        let flashClass = '';
        if (oldLtp != null && ltp != null && oldLtp !== ltp) {
            flashClass = ltp > oldLtp ? 'ltp-flash-green' : 'ltp-flash-red';
        }

        const ltpDisplay = ltp != null
            ? `<div class="${flashClass}">${fmtINR(ltp)}</div>`
            : `<span class="pt-loading">…</span>`;
            
        // Weight %
        const weightPct = (evalVal => evalVal > 0 && effectiveTotal > 0 ? (evalVal / effectiveTotal * 100).toFixed(1) : '0.0')
                            (currentVal != null ? currentVal : invested);

        // Progress Bar
        let progressPct = 0;
        let progressColor = 'var(--text-muted)';
        if (invested > 0 && currentVal != null) {
            progressPct = Math.min((currentVal / invested) * 100, 150);
            progressColor = currentVal >= invested ? 'var(--accent)' : 'var(--red)';
        }

        // Badges
        let badgeHtml = '';
        if (idx === bestIdx && maxPct > 0) badgeHtml = `<span class="pt-badge pt-badge-best">↑ BEST</span>`;
        if (idx === worstIdx && minPct < 0) badgeHtml = `<span class="pt-badge pt-badge-worst">↓ WORST</span>`;
        
        // Warn Chip
        let warnHtml = '';
        if (pnlPct != null && pnlPct < -10) {
            warnHtml = `<div class="pt-warn-chip">⚠ ${pnlPct.toFixed(1)}%</div>`;
        }

        return `
        <tr class="pt-row ${rowClass}" style="animation-delay:${idx * 40}ms">
            <td class="pt-ticker-cell" style="position:relative; overflow:hidden;">
                <span class="pt-ticker-badge">${h.ticker.replace('.NS', '')}</span>
                <span class="pt-badge pt-badge-weight">${weightPct}%</span>
                ${badgeHtml}
                <span class="pt-company">${escHtml(h.companyName)}</span>
                ${warnHtml}
                <div class="pt-progress-wrap"><div class="pt-progress-bar" style="width: ${progressPct}%; background-color: ${progressColor};"></div></div>
            </td>
            <td class="pt-num">${fmtQty(h.qty)}</td>
            <td class="pt-num col-avg-buy">${fmtINR(h.avgBuyPrice)}</td>
            <td class="pt-num pt-ltp">${ltpDisplay}</td>
            <td class="pt-num">${fmtINR(invested)}</td>
            <td class="pt-num ${posClass}">${fmtINR(currentVal)}</td>
            <td class="pt-num ${posClass} pt-bold">
                ${fmtINR(pnl)}
                <span class="pt-pct">${fmtPct(pnlPct)}</span>
            </td>
            <td class="pt-sparkline-cell col-trend">
                <canvas id="spark-${idx}" class="pt-sparkline-canvas"></canvas>
            </td>
            <td>
                <button class="pt-del-btn" onclick="deleteHolding(${idx})" title="Remove holding">✕</button>
            </td>
        </tr>`;
    }).join('');
    
    // Render sparklines after DOM update
    holdings.forEach((h, idx) => {
        renderSparkline(h.ticker, idx);
    });
}

// Sparkline rendering cache
const sparklineData = {};

async function renderSparkline(ticker, idx) {
    const canvas = document.getElementById(`spark-${idx}`);
    if (!canvas) return;
    
    // Use cached data to avoid re-fetching on every table render (e.g., when adding a new holding)
    // We will clear this cache when forcing a full refresh
    let prices = sparklineData[ticker];
    
    if (!prices) {
        try {
            const res = await fetch(`/api/sparkline?symbol=${encodeURIComponent(ticker)}`);
            if (res.ok) {
                const data = await res.json();
                prices = data.prices;
                sparklineData[ticker] = prices;
            }
        } catch (e) {
            console.error("Sparkline fetch failed:", e);
        }
    }
    
    if (!prices || prices.length === 0) return;
    
    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#00ff88' : '#ff3b3b';
    
    if (window[`chart_spark_${idx}`]) {
        window[`chart_spark_${idx}`].destroy();
    }
    
    const ctx = canvas.getContext('2d');
    window[`chart_spark_${idx}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: prices.map((_, i) => i),
            datasets: [{
                data: prices,
                borderColor: color,
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
            animation: false
        }
    });
}

// Override refreshPrices to also clear sparkline cache
const _originalRefreshPrices = refreshPrices;
refreshPrices = async function() {
    // Clear sparkline cache so it fetches fresh data
    for (const key in sparklineData) delete sparklineData[key];
    await _originalRefreshPrices.apply(this);
};

function renderSummaryBar() {
    const { totalInvested, totalCurrent, totalPnl, totalPnlPct } = calcPortfolioTotals();
    const posClass = totalPnl == null ? '' : totalPnl >= 0 ? 'pt-pos' : 'pt-neg';

    const el = (id, val) => {
        const e = document.getElementById(id);
        if (e) e.textContent = val;
    };
    const cls = (id, c) => {
        const e = document.getElementById(id);
        if (e) { e.className = e.className.replace(/pt-pos|pt-neg/g, '').trim(); if (c) e.classList.add(c); }
    };

    el('pt-total-invested', fmtINR(totalInvested));
    el('pt-total-current', fmtINR(totalPnl != null ? totalCurrent : null));
    el('pt-total-pnl', fmtINR(totalPnl));
    el('pt-total-pct', fmtPct(totalPnlPct));
    el('pt-holding-count', `${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`);
    cls('pt-total-pnl', posClass);
    cls('pt-total-pct', posClass);
}

// ── Add holding modal ─────────────────────────────────────────────────────────

function openAddModal() {
    const modal = document.getElementById('pt-modal');
    if (!modal) return;
    modal.classList.add('pt-modal-open');
    document.getElementById('pt-form-ticker').value = '';
    document.getElementById('pt-form-company').value = '';
    document.getElementById('pt-form-qty').value = '';
    document.getElementById('pt-form-price').value = '';
    document.getElementById('pt-form-ticker').focus();
    document.getElementById('pt-form-error').textContent = '';
    document.getElementById('pt-ltp-hint').textContent = '';
}

function closeAddModal() {
    document.getElementById('pt-modal')?.classList.remove('pt-modal-open');
}

async function handleTickerBlur() {
    const tickerInput = document.getElementById('pt-form-ticker');
    const priceInput = document.getElementById('pt-form-price');
    const hint = document.getElementById('pt-ltp-hint');
    const raw = tickerInput.value.trim();
    if (!raw) return;

    hint.textContent = 'Fetching current price…';
    try {
        const quote = await fetchQuoteForTicker(raw);
        priceInput.value = quote.close.toFixed(2);
        hint.textContent = `LTP: ₹${quote.close.toFixed(2)} as of ${quote.date}`;
    } catch {
        hint.textContent = 'Could not fetch price — enter manually';
    }
}

async function submitAddHolding() {
    const errEl = document.getElementById('pt-form-error');
    errEl.textContent = '';

    const rawTicker = document.getElementById('pt-form-ticker').value.trim().toUpperCase();
    const companyName = document.getElementById('pt-form-company').value.trim() || rawTicker;
    const qty = parseFloat(document.getElementById('pt-form-qty').value);
    const avgBuyPrice = parseFloat(document.getElementById('pt-form-price').value);

    // Validate
    if (!rawTicker) return (errEl.textContent = 'Ticker is required');
    if (isNaN(qty) || qty <= 0) return (errEl.textContent = 'Enter a valid quantity');
    if (isNaN(avgBuyPrice) || avgBuyPrice <= 0) return (errEl.textContent = 'Enter a valid buy price');

    const ticker = rawTicker.endsWith('.NS') ? rawTicker : `${rawTicker}.NS`;

    const token = await getAuthToken();
    if (!token) return (errEl.textContent = 'You must be logged in to add holdings');

    // Check for duplicate
    const existingIdx = holdings.findIndex(h => h.ticker === ticker);
    try {
        if (existingIdx >= 0) {
            // Average down / up: weighted average
            const existing = holdings[existingIdx];
            const totalQty = existing.qty + qty;
            const newAvg = ((existing.qty * existing.avgBuyPrice) + (qty * avgBuyPrice)) / totalQty;
            
            const res = await fetch(`/api/holdings/${encodeURIComponent(ticker)}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ qty: totalQty, avg_buy_price: newAvg, ticker, company_name: companyName })
            });
            if (!res.ok) throw new Error('Failed to update holding');
            
            holdings[existingIdx] = { ...existing, qty: totalQty, avgBuyPrice: newAvg };
            showPortfolioToast(`Updated ${ticker} — averaged to ₹${newAvg.toFixed(2)}`, 'success');
        } else {
            const res = await fetch('/api/holdings', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker, company_name: companyName, qty, avg_buy_price: avgBuyPrice })
            });
            if (!res.ok) throw new Error('Failed to add holding');
            
            holdings.push({ ticker, companyName, qty, avgBuyPrice });
            showPortfolioToast(`Added ${ticker} to portfolio`, 'success');
        }

        closeAddModal();
        renderPortfolioTable();
        renderSummaryBar();

        // Immediately fetch live price for the new holding
        try {
            const quote = await fetchQuoteForTicker(ticker);
            livePrices[ticker] = quote.close;
            renderPortfolioTable();
            renderSummaryBar();
        } catch { /* silent — user can refresh manually */ }
    } catch (err) {
        errEl.textContent = err.message;
    }
}

// ── Delete holding ────────────────────────────────────────────────────────────

async function deleteHolding(idx) {
    const ticker = holdings[idx]?.ticker;
    if (!ticker) return;
    
    const token = await getAuthToken();
    if (!token) return showPortfolioToast("Not authenticated", "error");

    try {
        const res = await fetch(`/api/holdings/${encodeURIComponent(ticker)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete');
        
        holdings.splice(idx, 1);
        renderPortfolioTable();
        renderSummaryBar();
        showPortfolioToast(`Removed ${ticker}`, 'error');
    } catch (err) {
        showPortfolioToast('Failed to delete holding', 'error');
    }
}

// ── Toast (portfolio-scoped, reuses main toast container) ─────────────────────

function showPortfolioToast(msg, type = 'success') {
    // Reuse the main app's showToast if available, else fallback
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `stitch-toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3500);
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function updateRefreshBtn(loading) {
    const btn = document.getElementById('pt-refresh-btn');
    if (!btn) return;
    btn.textContent = loading ? 'Refreshing…' : '↻ Refresh Prices';
    btn.disabled = loading;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initPortfolio() {
    await loadHoldings();
    renderPortfolioTable();
    renderSummaryBar();

    // Fetch live prices on load if holdings exist
    if (holdings.length) refreshPrices();

    // Wire up Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAddModal();
    });
}

// ── Auth integration ────────────────────────────────────────────────────────

// ── Portfolio Analysis (PyPortfolioOpt) ──────────────────────────────────────

let analysisLoading = false;

/**
 * Executes a Mean-Variance Optimization on the user's holdings.
 * Communicates with the /api/portfolio/analyze endpoint.
 */
async function analyzePortfolio() {
    if (analysisLoading) return;
    if (holdings.length < 2) {
        showPortfolioToast('Add at least 2 holdings to run portfolio analysis.', 'warning');
        return;
    }

    const btn = document.getElementById('pt-analyze-btn');
    const container = document.getElementById('pt-analysis-results');
    
    analysisLoading = true;
    if (btn) {
        btn.innerHTML = "⚡ <span>Analyzing...</span>";
        btn.disabled = true;
    }
    if (container) {
        document.querySelector('.pt-summary-bar')?.classList.add('pt-hidden');
        document.querySelector('.pt-table-card')?.classList.add('pt-hidden');
        container.innerHTML = `
            <div class="pt-analysis-loader" style="padding: 2rem; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-top: 1rem;">
                <div class="pt-loader-spinner" style="width: 30px; height: 30px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: pt-spin 0.8s linear infinite; margin: 0 auto 1rem;"></div>
                <p style="font-family: var(--sans); color: var(--text);">Running Mean-Variance Optimization...</p>
                <p style="font-size: 0.7rem; opacity: 0.6; font-family: var(--mono); color: var(--text-muted);">Calculating Efficient Frontier & Sharpe Ratios</p>
            </div>
        `;
        container.classList.remove('pt-hidden');
    }

    try {
        const token = await getAuthToken();
        const requestBody = {
            holdings: holdings.map(h => ({
                ticker: h.ticker,
                company_name: h.companyName,
                qty: h.qty,
                avg_buy_price: h.avgBuyPrice
            }))
        };

        const res = await fetch('/api/portfolio/analyze', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Analysis failed");
        }

        const data = await res.json();
        renderOptimizationResults(data);
    } catch (err) {
        if (container) {
            container.innerHTML = `
                <div class="pt-analysis-error" style="padding: 2rem; text-align: center; background: rgba(255,59,59,0.05); border: 1px solid var(--red); border-radius: 8px; margin-top: 1rem;">
                    <p style="color: var(--red); font-weight: bold;">❌ Optimization Failed</p>
                    <p style="font-size: 0.8rem; opacity: 0.8; color: var(--text-muted);">${err.message}</p>
                    <button class="pt-btn" style="margin-top: 10px;" onclick="analyzePortfolio()">Retry Analysis</button>
                </div>
            `;
        }
        showPortfolioToast(err.message, "error");
    } finally {
        analysisLoading = false;
        if (btn) {
            btn.innerHTML = "⚡ <span>Analyze</span>";
            btn.disabled = false;
        }
    }
}

/**
 * Dynamically renders the results of the portfolio analysis.
 */
function renderOptimizationResults(data) {
    const container = document.getElementById('pt-analysis-results');
    if (!container) return;

    const { 
        current_sharpe, optimized_sharpe, 
        diversification_score, suggestions, 
        sector_concentration, current_weights,
        optimized_weights
    } = data;

    const currentSharpeVal = current_sharpe || 0;
    const optimizedSharpeVal = optimized_sharpe || 0;
    const sharpeDiff = (optimizedSharpeVal - currentSharpeVal).toFixed(2);
    const sharpeColor = sharpeDiff > 0 ? 'var(--accent)' : 'var(--text-muted)';

    let totalInvested = 0;
    let totalCurrent = 0;
    
    holdings.forEach(h => {
        const invested = h.qty * h.avgBuyPrice;
        const ltp = livePrices[h.ticker] || h.avgBuyPrice;
        const currentVal = h.qty * ltp;
        totalInvested += invested;
        totalCurrent += currentVal;
    });

    const totalPnl = totalCurrent - totalInvested;
    const totalReturn = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const pnlColor = totalPnl >= 0 ? 'var(--accent)' : 'var(--red)';

    container.innerHTML = `
        <!-- Section 1: Summary Bar -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem; margin-bottom: 1.5rem;">
            <div style="background: var(--surface-light); padding: 16px; border-radius: 8px;">
                <div style="font-family: var(--mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted); opacity: 0.8; letter-spacing: 0.1em; margin-bottom: 4px;">Invested</div>
                <div style="font-family: var(--sans); font-size: 22px; font-weight: bold; color: var(--text);">${fmtINR(totalInvested)}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${holdings.length} holdings</div>
            </div>
            <div style="background: var(--surface-light); padding: 16px; border-radius: 8px;">
                <div style="font-family: var(--mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted); opacity: 0.8; letter-spacing: 0.1em; margin-bottom: 4px;">Current Value</div>
                <div style="font-family: var(--sans); font-size: 22px; font-weight: bold; color: var(--text);">${fmtINR(totalCurrent)}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">live market data</div>
            </div>
            <div style="background: var(--surface-light); padding: 16px; border-radius: 8px;">
                <div style="font-family: var(--mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted); opacity: 0.8; letter-spacing: 0.1em; margin-bottom: 4px;">Total P&L</div>
                <div style="font-family: var(--sans); font-size: 22px; font-weight: bold; color: ${pnlColor};">${totalPnl >= 0 ? '+' : ''}${fmtINR(totalPnl)}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">since purchase</div>
            </div>
            <div style="background: var(--surface-light); padding: 16px; border-radius: 8px;">
                <div style="font-family: var(--mono); font-size: 11px; text-transform: uppercase; color: var(--text-muted); opacity: 0.8; letter-spacing: 0.1em; margin-bottom: 4px;">Return</div>
                <div style="font-family: var(--sans); font-size: 22px; font-weight: bold; color: ${pnlColor};">${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">unrealized gain/loss</div>
            </div>
        </div>

        <!-- Section 2: Holdings Table -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 1.5rem;">
            <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;">Holdings Breakdown</div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: var(--sans); font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border); font-family: var(--mono); font-size: 11px; color: var(--text-muted); text-transform: uppercase;">
                            <th style="padding: 12px 8px;">Stock</th>
                            <th style="padding: 12px 8px;">Qty</th>
                            <th class="col-avg-buy" style="padding: 12px 8px;">Avg Buy</th>
                            <th style="padding: 12px 8px;">LTP</th>
                            <th style="padding: 12px 8px;">Invested</th>
                            <th style="padding: 12px 8px;">Current</th>
                            <th style="padding: 12px 8px;">P&L</th>
                            <th style="padding: 12px 8px; width: 120px;">Allocation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${holdings.map(h => {
                            const inv = h.qty * h.avgBuyPrice;
                            const lp = livePrices[h.ticker] || h.avgBuyPrice;
                            const cur = h.qty * lp;
                            const pnl = cur - inv;
                            const pnlPct = inv > 0 ? (pnl / inv) * 100 : 0;
                            const pnlCol = pnl >= 0 ? 'var(--accent)' : 'var(--red)';
                            const allocPct = totalCurrent > 0 ? (cur / totalCurrent) * 100 : 0;
                            const badgeBg = pnl >= 0 ? 'rgba(0, 200, 150, 0.1)' : 'rgba(244, 63, 94, 0.1)';
                            const badgeCol = pnl >= 0 ? 'var(--accent)' : 'var(--red)';

                            return `
                            <tr style="border-bottom: 1px solid var(--border-light);">
                                <td style="padding: 12px 8px;">
                                    <span style="background: ${badgeBg}; color: ${badgeCol}; padding: 4px 8px; border-radius: 12px; font-family: var(--mono); font-weight: bold; font-size: 0.8rem;">${h.ticker.replace('.NS', '')}</span>
                                </td>
                                <td style="padding: 12px 8px;">${fmtQty(h.qty)}</td>
                                <td class="col-avg-buy" style="padding: 12px 8px;">${fmtINR(h.avgBuyPrice)}</td>
                                <td style="padding: 12px 8px;">${fmtINR(lp)}</td>
                                <td style="padding: 12px 8px;">${fmtINR(inv)}</td>
                                <td style="padding: 12px 8px;">${fmtINR(cur)}</td>
                                <td style="padding: 12px 8px;">
                                    <div style="color: ${pnlCol}; font-weight: bold;">${pnl >= 0 ? '+' : ''}${fmtINR(pnl)}</div>
                                    <div style="color: ${pnlCol}; font-size: 0.75rem; opacity: 0.8;">${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
                                </td>
                                <td style="padding: 12px 8px;">
                                    <div style="font-family: var(--mono); font-size: 0.8rem; margin-bottom: 4px; color: var(--text);">${allocPct.toFixed(1)}%</div>
                                    <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                                        <div style="width: ${allocPct}%; height: 100%; background: ${pnlCol}; border-radius: 2px;"></div>
                                    </div>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Section 3: Analysis section -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;">Diversity Score</div>
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="font-family: var(--sans); font-size: 48px; font-weight: bold; color: ${getScoreColor(diversification_score)}; line-height: 1;">
                        ${diversification_score}<span style="font-size: 20px; color: var(--text-muted); opacity: 0.5;">/100</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${diversification_score < 50 ? 'Heavily Concentrated' : diversification_score < 75 ? 'Moderately Diversified' : 'Well Diversified'}</div>
                </div>
                <div style="border-top: 1px solid var(--border); margin: 16px 0;"></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                    <span style="color: var(--text-muted);">Current Sharpe</span>
                    <span style="font-family: var(--mono); color: var(--text); font-weight: bold;">${currentSharpeVal}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                    <span style="color: var(--text-muted);">Optimal Sharpe</span>
                    <span style="font-family: var(--mono); color: var(--accent); font-weight: bold;">${optimizedSharpeVal}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: var(--text-muted);">Potential Delta</span>
                    <span style="font-family: var(--mono); color: ${sharpeColor}; font-weight: bold;">+${sharpeDiff}</span>
                </div>
            </div>

            <!-- Engineered Insights -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;">Engineered Insights</div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${suggestions.map(s => {
                        let dotColor = 'var(--text-muted)';
                        if (s.toLowerCase().includes('warning') || s.toLowerCase().includes('reduce') || s.toLowerCase().includes('high risk')) dotColor = 'var(--red)';
                        else if (s.toLowerCase().includes('good') || s.toLowerCase().includes('optimal') || s.toLowerCase().includes('buy')) dotColor = 'var(--accent)';
                        else dotColor = 'var(--yellow)';
                        
                        return `
                        <div style="display: flex; gap: 10px; align-items: flex-start;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; margin-top: 5px; flex-shrink: 0;"></div>
                            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">${s}</div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Sector Vector -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;">Sector Vector</div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${Object.entries(sector_concentration).sort((a,b) => b[1] - a[1]).map(([sector, pct]) => {
                        const barColor = pct > 20 ? 'var(--accent)' : 'var(--text-muted)';
                        return `
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 80px; font-size: 11px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sector}</div>
                            <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                                <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 3px;"></div>
                            </div>
                            <div style="width: 40px; text-align: right; font-family: var(--mono); font-size: 11px; color: var(--text-muted);">${pct.toFixed(1)}%</div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>

        <!-- Section 4: Reallocation Matrix -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 1.5rem;">
            <div style="font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;">Reallocation Matrix</div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: var(--sans); font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border); font-family: var(--mono); font-size: 11px; color: var(--text-muted); text-transform: uppercase;">
                            <th style="padding: 12px 8px;">Asset</th>
                            <th style="padding: 12px 8px;">Current Allocation</th>
                            <th style="padding: 12px 8px;">Optimized Target</th>
                            <th style="padding: 12px 8px;">Change</th>
                            <th style="padding: 12px 8px;">Strategy</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(current_weights).map(ticker => {
                            const curr = current_weights[ticker];
                            const opt = optimized_weights[ticker] || 0;
                            const diff = opt - curr;
                            
                            let strategyText = 'HOLD';
                            let strategyBg = 'rgba(144, 144, 144, 0.1)';
                            let strategyCol = 'var(--text-muted)';
                            let changeText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                            let changeCol = 'var(--text-muted)';
                            
                            if (diff > 5) {
                                strategyText = 'BUY';
                                strategyBg = 'rgba(0, 200, 150, 0.1)';
                                strategyCol = 'var(--accent)';
                                changeCol = 'var(--accent)';
                            } else if (diff < -5) {
                                strategyText = 'REDUCE';
                                strategyBg = 'rgba(244, 63, 94, 0.1)';
                                strategyCol = 'var(--red)';
                                changeCol = 'var(--red)';
                            }
                            
                            return `
                            <tr style="border-bottom: 1px solid var(--border-light);">
                                <td style="padding: 12px 8px; font-family: var(--mono); font-weight: bold; color: var(--text);">${ticker.replace('.NS', '')}</td>
                                <td style="padding: 12px 8px; color: var(--text);">${curr.toFixed(1)}%</td>
                                <td style="padding: 12px 8px; font-weight: bold; color: var(--text);">${opt.toFixed(1)}%</td>
                                <td style="padding: 12px 8px; font-family: var(--mono); font-weight: bold; color: ${changeCol};">${changeText}</td>
                                <td style="padding: 12px 8px;">
                                    <span style="background: ${strategyBg}; color: ${strategyCol}; padding: 4px 10px; border-radius: 12px; font-family: var(--mono); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.05em;">${strategyText}</span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Scroll to results
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Helper: returns color based on diversity score */
function getScoreColor(score) {
    if (score >= 75) return 'var(--accent)';
    if (score >= 50) return 'var(--accent2)';
    return 'var(--red)';
}

/** Helper: returns color mapping for sectors */
function getSectorColor(sector) {
    const colors = {
        'IT': '#00d2ff',
        'Banking': '#ffcc33',
        'Energy': '#ff8c00',
        'FMCG': '#00ff88',
        'Pharma': '#ff33cc',
        'Auto': '#99ccff',
        'Metals': '#c0c0c0',
        'Banking': '#fedc00',
        'Other': 'var(--text-muted)'
    };
    return colors[sector] || colors['Other'];
}

// Wait for supabase + confirmed session before initialising
const checkSupabaseAndInit = setInterval(async () => {
    if (!window.supabase) return;
    clearInterval(checkSupabaseAndInit);

    // onAuthStateChange is the reliable signal — fires once session is confirmed
    window.supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
            document.getElementById('pt-auth-gate')?.classList.add('pt-hidden');
            document.getElementById('pt-main-content')?.classList.remove('pt-hidden');
            initPortfolio();
        } else {
            document.getElementById('pt-auth-gate')?.classList.remove('pt-hidden');
            document.getElementById('pt-main-content')?.classList.add('pt-hidden');
            holdings = [];
            livePrices = {};
            renderPortfolioTable();
            renderSummaryBar();
        }
    });

    // Fallback: getSession with retry — wait up to 3s for session to restore
    let attempts = 0;
    const sessionPoll = setInterval(async () => {
        attempts++;
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session?.user) {
            clearInterval(sessionPoll);
            document.getElementById('pt-auth-gate')?.classList.add('pt-hidden');
            document.getElementById('pt-main-content')?.classList.remove('pt-hidden');
            initPortfolio();
        } else if (attempts >= 6) { // 6 × 500ms = 3s timeout
            clearInterval(sessionPoll);
            document.getElementById('pt-auth-gate')?.classList.remove('pt-hidden');
            document.getElementById('pt-main-content')?.classList.add('pt-hidden');
        }
    }, 500);
}, 50);

// Keyframe for spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes pt-spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);