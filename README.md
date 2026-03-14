# DalalScope 📈

A full-stack NSE (National Stock Exchange of India) stock market 
dashboard that fetches and displays real-time OHLCV 
(Open, High, Low, Close, Volume) data for Indian stocks.

🔗 **Live Demo**: https://dalalscope.onrender.com

---

## What It Does

DalalScope lets you search any NSE-listed stock by ticker symbol 
or company name and instantly view:

- **Latest trading day** OHLCV data with summary stats
- **Historical data** for any custom date range
- **CSV export** of any fetched data
- Real-time **NSE market open/closed** status in IST

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Source | `yfinance` (Yahoo Finance API) |
| Backend | Python + FastAPI |
| Server | Uvicorn (ASGI) |
| Frontend | HTML + CSS + JavaScript |
| Hosting | Render.com (free tier) |
| Uptime | UptimeRobot (keeps server awake 24/7) |

---

## Project Structure

```text
DalalScope/
├── api.py           # FastAPI backend — REST API endpoints
├── resolver.py      # Company name → NSE ticker resolution
├── fetcher.py       # yfinance OHLCV data fetching
├── output.py        # Table formatting and CSV export
├── scraper.py       # Original CLI tool (kept intact)
├── Procfile         # Render deployment start command
├── runtime.txt      # Python version pin (3.11.9)
├── requirements.txt # Project dependencies
├── static/
│   └── index.html   # Full frontend dashboard UI
└── README.md
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stock/latest?ticker=TCS` | Latest trading day OHLCV |
| `GET /api/stock/history?ticker=RELIANCE&start=2024-01-01&end=2024-12-31` | Historical OHLCV |
| `GET /api/stock/resolve?company=Tata+Consultancy+Services` | Resolve company name to ticker |
| `GET /health` | Health check |

---

## Run Locally

```bash
# Clone the repo
git clone https://github.com/shwetankrai12/DalalScope
cd DalalScope

# Install dependencies
pip install -r requirements.txt

# Start the server
python -m uvicorn api:app --host 0.0.0.0 --port 8000

# Open in browser
http://localhost:8000
```

---

## How It Was Built

This project was **vibe coded** — built iteratively using 
**GitHub Copilot** and **AI-assisted prompting** with 
**Antigravity** as the development environment.

### Development Journey

**Started as a CLI tool**
The project began as a pure Python command-line scraper 
(`scraper.py`) that printed OHLCV tables in the terminal 
and exported CSVs.

**Evolved into a full-stack web app**
The CLI was wrapped with a FastAPI backend and a dark 
terminal-aesthetic frontend dashboard was built on top of it.

**Complications faced along the way:**

- 🐛 **Python 3.14 conflict** — Render defaulted to Python 3.14 
  which broke pandas. Fixed by pinning `PYTHON_VERSION=3.11.9` 
  as an environment variable on Render.

- 🐛 **Case sensitivity on Linux** — Procfile had `Python` 
  (capital P) which worked on Windows but failed on Render's 
  Linux servers. Fixed by changing to `python` (lowercase).

- 🐛 **Uvicorn not found (status 127)** — Render was using its 
  own Start Command instead of Procfile. Fixed by updating the 
  Start Command directly in Render dashboard settings.

- 🐛 **Cold start delays** — Render's free tier sleeps after 
  15 minutes of inactivity causing 50+ second delays. Fixed 
  using UptimeRobot to ping the server every 5 minutes.

- 🐛 **CSV export not working** — Button was permanently 
  disabled due to broken enable/disable logic. Fixed with 
  correct client-side Blob download implementation.

---

## Deployment

Hosted on **[Render.com](https://render.com)** free tier.

- Auto-deploys on every `git push` to `main`
- Start command: `python -m uvicorn api:app --host 0.0.0.0 --port $PORT`
- Python version: 3.11.9 (set via environment variable)

**Uptime**: Kept alive 24/7 using 
**[UptimeRobot](https://uptimerobot.com)** which pings 
the server every 5 minutes to prevent cold starts.

---

## Future Ideas

- [ ] Candlestick chart visualization
- [ ] Multiple ticker comparison
- [ ] Portfolio tracker
- [ ] Price alerts via email
- [ ] Sensex / Nifty 50 index overview

---

## Author

Built by [@shwetankrai12](https://github.com/shwetankrai12)
