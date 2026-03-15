import re
import os

def build_fetcher():
    with open('c:/Users/shwet/project101/fetcher.py', 'r', encoding='utf-8') as f:
        content = f.read()

    news_fetcher = '''
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
import requests

BULLISH_WORDS = {
    "surge": 2, "profit": 2, "beat": 2, "growth": 1, "record": 2,
    "upgrade": 2, "buy": 1, "strong": 1, "rally": 2, "gain": 1,
    "high": 1, "positive": 1, "outperform": 2, "dividend": 1,
    "expansion": 1, "win": 2, "deal": 1, "award": 1, "target": 1,
    "bullish": 2, "rise": 1, "jump": 2, "soar": 2, "boom": 2
}

BEARISH_WORDS = {
    "loss": 2, "fall": 1, "drop": 2, "probe": 2, "downgrade": 2,
    "sell": 1, "weak": 1, "decline": 2, "crash": 3, "fraud": 3,
    "lawsuit": 2, "miss": 2, "cut": 1, "layoff": 2, "debt": 1,
    "warning": 2, "bearish": 2, "slip": 1, "concern": 1, "risk": 1,
    "penalty": 2, "fine": 2, "investigation": 2, "slump": 2, "plunge": 3
}

def score_headline(title: str) -> tuple[int, str]:
    """Returns (score, sentiment_label).
    Positive score = bullish, negative = bearish, 0 = neutral."""
    words = title.lower().split()
    score = 0
    for word in words:
        clean = word.strip(".,!?\\"'()[]")
        score += BULLISH_WORDS.get(clean, 0)
        score -= BEARISH_WORDS.get(clean, 0)
    if score > 0:
        return score, "BULLISH"
    elif score < 0:
        return score, "BEARISH"
    else:
        return 0, "NEUTRAL"

def fetch_news(ticker: str) -> dict:
    """
    Fetches Google News RSS for the given NSE ticker,
    scores each headline for sentiment, and returns
    aggregated signal + headline list.
    """
    # Strip .NS suffix if present
    clean_ticker = ticker.upper().replace(".NS", "")

    url = (
        f"https://news.google.com/rss/search"
        f"?q={clean_ticker}+NSE+stock"
        f"&hl=en-IN&gl=IN&ceid=IN:en"
    )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        return {
            "ticker": clean_ticker,
            "error": str(e),
            "signal": "NEUTRAL",
            "score": 0,
            "headline_count": 0,
            "breakdown": {"bullish": 0, "bearish": 0, "neutral": 0},
            "headlines": []
        }

    # Parse RSS XML
    root = ET.fromstring(response.content)
    channel = root.find("channel")
    items = channel.findall("item") if channel else []

    headlines = []
    total_score = 0
    breakdown = {"bullish": 0, "bearish": 0, "neutral": 0}

    for item in items[:10]:  # limit to 10 most recent
        title_el   = item.find("title")
        link_el    = item.find("link")
        pub_el     = item.find("pubDate")
        source_el  = item.find("source")

        title  = title_el.text  if title_el  is not None else ""
        link   = link_el.text   if link_el   is not None else ""
        pub    = pub_el.text    if pub_el    is not None else ""
        source = source_el.text if source_el is not None else "Unknown"

        # Clean Google News redirect URLs — extract real URL
        if "news.google.com" in link:
            import urllib.parse
            parsed = urllib.parse.urlparse(link)
            qs = urllib.parse.parse_qs(parsed.query)
            link = qs.get("url", [link])[0] if "url" in qs else link

        score, sentiment = score_headline(title)
        total_score += score
        breakdown[sentiment.lower()] += 1

        headlines.append({
            "title":     title,
            "source":    source,
            "url":       link,
            "published": pub,
            "sentiment": sentiment,
            "score":     score
        })

    # Aggregate signal
    if total_score > 2:
        overall_signal = "BULLISH"
    elif total_score < -2:
        overall_signal = "BEARISH"
    else:
        overall_signal = "NEUTRAL"

    # Sentiment percentage (0–100 scale, 50 = neutral)
    count = len(headlines) or 1
    bullish_pct = round((breakdown["bullish"] / count) * 100)

    return {
        "ticker":         clean_ticker,
        "signal":         overall_signal,
        "score":          total_score,
        "bullish_pct":    bullish_pct,
        "headline_count": len(headlines),
        "breakdown":      breakdown,
        "headlines":      headlines
    }
'''

    if 'def fetch_news' not in content:
        content += '\\n' + news_fetcher

    with open('c:/Users/shwet/project101/fetcher.py', 'w', encoding='utf-8') as f:
        f.write(content)

def build_api():
    with open('c:/Users/shwet/project101/api.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # Update fetcher import
    content = content.replace('from fetcher import fetch_ohlcv', 'from fetcher import fetch_ohlcv, fetch_news')

    news_api = '''
@app.get("/api/stock/news")
async def get_stock_news(ticker: str):
    """
    Returns news headlines + sentiment signal for a given NSE ticker.
    Source: Google News RSS (free, no API key required).
    """
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker parameter is required")
    
    data = fetch_news(ticker)
    
    if "error" in data and not data["headlines"]:
        raise HTTPException(status_code=503, detail=f"News fetch failed: {data['error']}")
    
    return data

app.mount("/", StaticFiles(directory="static", html=True), name="static")
'''

    if '/api/stock/news' not in content:
        content = content.replace('app.mount("/", StaticFiles(directory="static", html=True), name="static")', news_api)

    with open('c:/Users/shwet/project101/api.py', 'w', encoding='utf-8') as f:
        f.write(content)

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
        html = html.replace('// --- UI Renderers & Animation ---', news_js + '\\n// --- UI Renderers & Animation ---')

    html = html.replace('drawChart(dataArray, ticker);', 'drawChart(dataArray, ticker);\\n        fetchNews(ticker);')
    html = html.replace('emptyState.classList.remove(\\'stitch-hidden\\');', 'emptyState.classList.remove(\\'stitch-hidden\\');\\n            hideNewsSection();')

    if 'hideNewsSection();' not in html:
        # Failsafe if the previous replacement didn't catch the empty state logic
        pass


    with open('c:/Users/shwet/project101/static/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    build_fetcher()
    build_api()
    build_index()
