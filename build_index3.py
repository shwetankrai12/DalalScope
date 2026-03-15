import re

# Read index.html
with open('static/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find the start of the `setInterval(cyclePlaceholder, 3200);` block
match = re.search(r'setInterval\(cyclePlaceholder, 3200\);', html)
if not match:
    print("Error: Could not find 'setInterval(cyclePlaceholder, 3200);' marker.")
    exit(1)

top_half = html[:match.start()]

# Define the new, complete bottom half
bottom_half = """setInterval(cyclePlaceholder, 3200);

function checkInputLengthForButton() {
   const btn = document.getElementById('search-btn');
   if(searchInput && searchInput.value.trim().length > 0) {
      if(btn) btn.disabled = false;
   } else {
      if(btn) btn.disabled = true;
   }
}
checkInputLengthForButton();

searchInput.addEventListener('input', () => {
  if(phEl) {
    phEl.style.display = searchInput.value ? 'none' : '';
    checkInputLengthForButton();
  }
});

function showPlaceholder() {
  if(phEl) phEl.style.display = '';
}

// --- Vanish Animation ---
async function vanishAndSubmit(inputEl, canvasEl, onComplete) {
  const ctx = canvasEl.getContext('2d');

  canvasEl.width  = inputEl.offsetWidth  * 2;
  canvasEl.height = inputEl.offsetHeight * 2;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  const cs = getComputedStyle(inputEl);
  const fs = parseFloat(cs.fontSize) * 2;
  ctx.font      = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
  ctx.fillStyle = '#ffffff';
  
  // Try to match exact drawing position. The input text starts around '36px' padding.
  ctx.fillText(inputEl.value, 72, fs + 6); 

  const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
  const d = imgData.data;
  const particles = [];
  for (let y = 0; y < canvasEl.height; y++) {
    for (let x = 0; x < canvasEl.width; x++) {
      const i = (y * canvasEl.width + x) * 4;
      if (d[i+3] > 128) {
        particles.push({ x, y, r: 1,
          color: `rgba(${d[i]},${d[i+1]},${d[i+2]},${d[i+3]/255})` });
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

</script>
</body>
</html>
"""

new_html = top_half + bottom_half

with open('static/index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("index.html repaired successfully!")
