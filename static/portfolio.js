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
        holdings = res.ok ? await res.json() : [];
        // normalize field names from snake_case to camelCase for the frontend
        holdings = holdings.map(h => ({
            ticker: h.ticker,
            companyName: h.company_name,
            qty: h.qty,
            avgBuyPrice: h.avg_buy_price
        }));
    } catch (err) {
        console.error("Failed to load holdings:", err);
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

    tbody.innerHTML = holdings.map((h, idx) => {
        const { ltp, invested, currentVal, pnl, pnlPct } = calcHoldingStats(h);
        const posClass = pnl == null ? '' : pnl >= 0 ? 'pt-pos' : 'pt-neg';
        const ltpDisplay = ltp != null
            ? fmtINR(ltp)
            : `<span class="pt-loading">…</span>`;

        return `
        <tr class="pt-row" style="animation-delay:${idx * 40}ms">
            <td class="pt-ticker-cell">
                <span class="pt-ticker-badge">${h.ticker.replace('.NS', '')}</span>
                <span class="pt-company">${escHtml(h.companyName)}</span>
            </td>
            <td class="pt-num">${fmtQty(h.qty)}</td>
            <td class="pt-num">${fmtINR(h.avgBuyPrice)}</td>
            <td class="pt-num pt-ltp">${ltpDisplay}</td>
            <td class="pt-num">${fmtINR(invested)}</td>
            <td class="pt-num ${posClass}">${fmtINR(currentVal)}</td>
            <td class="pt-num ${posClass} pt-bold">
                ${fmtINR(pnl)}
                <span class="pt-pct">${fmtPct(pnlPct)}</span>
            </td>
            <td>
                <button class="pt-del-btn" onclick="deleteHolding(${idx})" title="Remove holding">✕</button>
            </td>
        </tr>`;
    }).join('');
}

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

// Wait for supabase to be ready on window
const checkSupabaseAndInit = setInterval(() => {
    if (window.supabase) {
        clearInterval(checkSupabaseAndInit);
        
        window.supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                initPortfolio();
            } else {
                holdings = [];
                livePrices = {};
                renderPortfolioTable();
                renderSummaryBar();
            }
        });

        // initial check
        window.supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) initPortfolio();
        });
    }
}, 50);