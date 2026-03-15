import re

def build_index():
    with open('c:/Users/shwet/project101/static/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # ------ HTML Injection ------
    news_html = '''
<!-- ── News + Sentiment Section ─────────────────────── -->
<section id="news-section">

  <!-- Signal banner -->
  <div class="signal-banner NEUTRAL" id="signal-banner">
    <div>
      <div class="signal-label NEUTRAL" id="signal-label">
        <span class="signal-arrow" id="signal-arrow">→</span>
        <span id="signal-text">NEUTRAL</span>
      </div>
      <div class="signal-meta" id="signal-meta">Analysing headlines…</div>
    </div>
    <div style="min-width:180px;">
      <div style="font-family:var(--mono);font-size:.68rem;color:var(--text-faint);margin-bottom:6px;letter-spacing:.08em;">BULLISH SENTIMENT</div>
      <div class="sentiment-meter">
        <div class="sentiment-fill NEUTRAL" id="sentiment-fill" style="width:50%"></div>
      </div>
      <div style="font-family:var(--mono);font-size:.72rem;color:var(--text-muted);margin-top:4px;" id="sentiment-pct">50%</div>
    </div>
  </div>

  <!-- Breakdown grid -->
  <div class="breakdown-grid">
    <div class="breakdown-card bullish">
      <div class="breakdown-number" id="bd-bullish">0</div>
      <div class="breakdown-tag">↑ Bullish</div>
    </div>
    <div class="breakdown-card bearish">
      <div class="breakdown-number" id="bd-bearish">0</div>
      <div class="breakdown-tag">↓ Bearish</div>
    </div>
    <div class="breakdown-card neutral">
      <div class="breakdown-number" id="bd-neutral">0</div>
      <div class="breakdown-tag">→ Neutral</div>
    </div>
  </div>

  <!-- Headlines list -->
  <div class="news-list">
    <div class="news-section-title">Latest Headlines</div>
    <div id="headlines-container">
      <!-- Skeleton loaders shown while fetching -->
      <div class="news-skeleton"></div>
      <div class="news-skeleton"></div>
      <div class="news-skeleton"></div>
    </div>
  </div>

</section>
'''

    if 'id="news-section"' not in html:
        # Inject after `<!-- Data Table Section --> ... </div>` section
        html = html.replace('</div>\\n        </div>\\n    </main>', '</div>\\n\\n            ' + news_html + '\\n        </div>\\n    </main>')

    # ------ CSS Injection ------
    news_css = '''
/* ── News & Sentiment Section ─────────────────────────── */
#news-section {
  display: none;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%; max-width: 900px;
  padding-bottom: 4rem;
}
#news-section.visible { display: flex; }

/* Signal banner */
.signal-banner {
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  display: flex; align-items: center;
  justify-content: space-between; flex-wrap: wrap; gap: 1rem;
  border: 1px solid var(--border);
}
.signal-banner.BULLISH { background: rgba(0,200,150,0.07); border-color: var(--accent); }
.signal-banner.BEARISH { background: rgba(244,63,94,0.07); border-color: var(--red); }
.signal-banner.NEUTRAL { background: rgba(91,122,160,0.07); border-color: var(--border); }

.signal-label {
  font-family: var(--mono); font-size: 1.4rem; font-weight: 700;
  display: flex; align-items: center; gap: 10px;
}
.signal-label.BULLISH { color: var(--accent); }
.signal-label.BEARISH { color: var(--red); }
.signal-label.NEUTRAL { color: var(--text-muted); }

.signal-arrow { font-size: 1.6rem; }

.signal-meta {
  font-family: var(--mono); font-size: .75rem;
  color: var(--text-muted); line-height: 1.6;
}

/* Sentiment meter bar */
.sentiment-meter {
  width: 100%; background: var(--border);
  border-radius: 4px; height: 6px; overflow: hidden;
}
.sentiment-fill {
  height: 100%; border-radius: 4px;
  transition: width .6s ease;
}
.sentiment-fill.BULLISH { background: var(--accent); }
.sentiment-fill.BEARISH { background: var(--red); }
.sentiment-fill.NEUTRAL { background: var(--text-muted); }

/* Breakdown cards */
.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .75rem;
}
.breakdown-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: .875rem 1rem;
  text-align: center;
}
.breakdown-card.bullish { border-color: rgba(0,200,150,0.3); }
.breakdown-card.bearish { border-color: rgba(244,63,94,0.3); }
.breakdown-number {
  font-family: var(--mono); font-size: 1.75rem; font-weight: 700;
}
.breakdown-card.bullish .breakdown-number { color: var(--accent); }
.breakdown-card.bearish .breakdown-number { color: var(--red); }
.breakdown-card.neutral .breakdown-number { color: var(--text-muted); }
.breakdown-tag {
  font-family: var(--mono); font-size: .65rem;
  letter-spacing: .1em; color: var(--text-faint);
  text-transform: uppercase; margin-top: 2px;
}

/* Headline cards */
.news-list { display: flex; flex-direction: column; gap: .5rem; }
.news-section-title {
  font-family: var(--mono); font-size: .7rem;
  letter-spacing: .12em; color: var(--text-faint);
  text-transform: uppercase; margin-bottom: .25rem;
}
.headline-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: .875rem 1rem;
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 1rem;
  text-decoration: none; transition: border-color .18s;
  cursor: pointer;
}
.headline-card:hover { border-color: var(--accent2); }
.headline-card.BULLISH:hover { border-color: var(--accent); }
.headline-card.BEARISH:hover { border-color: var(--red); }

.headline-left { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.headline-title {
  font-family: var(--sans); font-size: .9rem;
  color: var(--text); line-height: 1.45;
}
.headline-meta {
  font-family: var(--mono); font-size: .68rem;
  color: var(--text-muted); display: flex; gap: 10px;
}
.headline-right { flex-shrink: 0; }
.sentiment-pill {
  font-family: var(--mono); font-size: .62rem;
  letter-spacing: .08em; padding: 3px 8px;
  border-radius: 4px; font-weight: 700;
}
.sentiment-pill.BULLISH { background: rgba(0,200,150,0.12); color: var(--accent); }
.sentiment-pill.BEARISH { background: rgba(244,63,94,0.12); color: var(--red); }
.sentiment-pill.NEUTRAL { background: rgba(91,122,160,0.12); color: var(--text-muted); }

/* News loading skeleton */
.news-skeleton {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: .875rem 1rem; height: 64px;
  position: relative; overflow: hidden;
}
.news-skeleton::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
'''

    if '#news-section {' not in html:
        html = html.replace('</style>', news_css + '\\n</style>')


    # ------ JS Injection ------
    news_js = '''
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
  const signal   = data.signal;   // "BULLISH" | "BEARISH" | "NEUTRAL"
  const pct      = data.bullish_pct;
  const count    = data.headline_count;
  const bd       = data.breakdown;

  // Signal banner
  const banner = document.getElementById('signal-banner');
  const label  = document.getElementById('signal-label');
  const arrow  = document.getElementById('signal-arrow');
  const text   = document.getElementById('signal-text');
  const meta   = document.getElementById('signal-meta');
  const fill   = document.getElementById('sentiment-fill');
  const pctEl  = document.getElementById('sentiment-pct');

  banner.className = `signal-banner ${signal}`;
  label.className  = `signal-label ${signal}`;
  fill.className   = `sentiment-fill ${signal}`;
  arrow.textContent = signal === 'BULLISH' ? '▲' : signal === 'BEARISH' ? '▼' : '→';
  text.textContent  = signal;
  meta.textContent  = `Based on ${count} headline${count !== 1 ? 's' : ''} · Google News · NSE`;
  fill.style.width  = pct + '%';
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
    const d    = new Date(pubDateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 60000); // minutes
    if (diff < 60)  return `${diff}m ago`;
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
  if(section) section.classList.remove('visible');
}
'''

    if 'function fetchNews' not in html:
        html = html.replace('</script>\\n</body>', news_js + '\\n</script>\\n</body>')

    html = html.replace('drawChart(dataArray, ticker);', 'drawChart(dataArray, ticker);\\n        fetchNews(ticker);')
    html = html.replace('emptyState.classList.remove(\\'stitch-hidden\\');', 'emptyState.classList.remove(\\'stitch-hidden\\');\\n            hideNewsSection();')

    with open('c:/Users/shwet/project101/static/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    build_index()
