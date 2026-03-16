# DalalScope 📈
https://dalalscope.onrender.com

A Python-based stock market data tool for the Indian (NSE) and US markets — available as both a **CLI tool** and a **web application** with a REST API.

---

## What It Does

DalalScope fetches OHLCV (Open, High, Low, Close, Volume) data for NSE-listed Indian stocks and US stocks like AAPL and MSFT. You can use it straight from the terminal or through a browser-friendly web interface backed by a REST API.

---

## Project Structure

```
DalalScope/
├── scraper.py          # Main CLI entry point with argument parsing
├── resolver.py         # Company name → NSE ticker symbol resolution
├── fetcher.py          # OHLCV data fetching via yfinance
├── output.py           # Table formatting and CSV export
├── api.py              # REST API server (web backend)
├── extract_values.py   # Value extraction utilities
├── quick_extract.py    # Quick data extraction helper
├── simple_extract.py   # Simplified extraction module
├── static/             # Frontend assets (HTML, CSS, JS)
├── requirements.txt    # Python dependencies
├── AAPL_ohlcv.csv      # Sample data — Apple Inc.
├── MSFT_ohlcv.csv      # Sample data — Microsoft
├── RELIANCE.NS_ohlcv.csv  # Sample data — Reliance Industries
└── TCS.NS_ohlcv.csv    # Sample data — Tata Consultancy Services
```

---

## Installation

```bash
git clone https://github.com/shwetankrai12/DalalScope.git
cd DalalScope
pip install -r requirements.txt
```

---

## Usage

### CLI Mode

**Fetch latest trading day data:**
```bash
python scraper.py --ticker TCS --mode latest
python scraper.py --company "Tata Consultancy Services" --mode latest
```

**Fetch historical data:**
```bash
python scraper.py --ticker RELIANCE --mode history --start 2025-12-01 --end 2025-12-31
python scraper.py --ticker TCS --mode history --start 2024-01-01 --end 2024-12-31
```

**Save output to a directory:**
```bash
python scraper.py --ticker TCS --mode latest --output ./data
```

### Web App / API Mode

Start the API server:
```bash
python api.py
```

Then open the browser and visit `http://localhost:<port>` to use the web interface, or hit the REST endpoints directly.

---

## Features

- **NSE Focus** — built specifically for Indian stock market data from NSE
- **Ticker Resolution** — accepts company names and auto-resolves to NSE ticker symbols (with `.NS` suffix)
- **Dual Mode**
  - `latest` — most recent trading day data
  - `history` — data for a custom date range
- **Dual Interface**
  - CLI for scripting and terminal use
  - Web frontend + REST API (`api.py` + `static/`) for browser-based access
- **CSV Export** — saves data as `<TICKER>_ohlcv.csv` files
- **Console Table** — formatted output using `tabulate`
- **Comprehensive Error Handling** — invalid tickers, missing dates, bad formats, API failures
- **Type Hints & Docstrings** — throughout the codebase for IDE support and readability

---

## Data Source

Uses **Yahoo Finance** (`yfinance`) for reliable NSE and US stock market data.

---

## Date Format

All dates must follow `YYYY-MM-DD` format — e.g., `2025-12-31`.

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Invalid company name | Error message + exit code 1 |
| Missing dates in history mode | Clear instructions with examples |
| Invalid date format | Format validation with example |
| No data for date range | Graceful error exit |
| API/network error | Wrapped with informative message |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data fetching | Python, yfinance |
| CLI | argparse |
| Web backend | Python (api.py) |
| Web frontend | HTML, CSS, JavaScript |
| Data output | tabulate, CSV |

---

## Sample Data

The repo includes pre-fetched sample CSVs for quick testing:
- `AAPL_ohlcv.csv` — Apple Inc. (US)
- `MSFT_ohlcv.csv` — Microsoft (US)
- `RELIANCE.NS_ohlcv.csv` — Reliance Industries (NSE)
- `TCS.NS_ohlcv.csv` — Tata Consultancy Services (NSE)
