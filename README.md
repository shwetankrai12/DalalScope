# NSE Stock Market Data Scraper

A Python CLI tool to fetch and display OHLCV (Open, High, Low, Close, Volume) stock market data from the National Stock Exchange (NSE) of India.

## Installation

1. Install dependencies:
```bash
python -m pip install -r requirements.txt
```

## Usage

### Fetch Latest Trading Day Data
```bash
python scraper.py --ticker TCS --mode latest
python scraper.py --company "Tata Consultancy Services" --mode latest
```

### Fetch Historical Data
```bash
python scraper.py --ticker RELIANCE --mode history --start 2025-12-01 --end 2025-12-31
python scraper.py --ticker TCS --mode history --start 2024-01-01 --end 2024-12-31
```

### Specify Output Directory
```bash
python scraper.py --ticker TCS --mode latest --output ./data
```

## Features

- **NSE Focus**: Specifically designed for Indian stock market data from NSE
- **Ticker Resolution**: Accept company names and automatically resolve to NSE ticker symbols with .NS suffix
- **Dual Mode**:
  - `latest` - Fetch the most recent trading day data
  - `history` - Fetch data for a date range
- **Output Format**:
  - Console table with tabulate formatting
  - CSV file export with NSE ticker naming
- **Error Handling**: Comprehensive validation and helpful error messages
- **Type Hints**: Full type hints for better IDE support
- **Docstrings**: Detailed documentation for all functions

## Project Structure

- `scraper.py` - Main CLI entry point with argument parsing
- `resolver.py` - Company name to NSE ticker symbol resolution
- `fetcher.py` - OHLCV data fetching using yfinance
- `output.py` - Table formatting and CSV file saving
- `requirements.txt` - Project dependencies

## Data Source

Uses Yahoo Finance (`yfinance`) for reliable NSE stock market data.

## Date Format

All dates must be in `YYYY-MM-DD` format (e.g., 2025-12-31)

## Error Handling

- Invalid company names → Helpful error message with exit code 1
- Missing dates for history mode → Clear instructions with examples
- Invalid date format → Format validation with example
- Missing data for date range → Graceful error exit
- API errors → Wrapped with informative error messages</content>
<parameter name="filePath">c:\Users\shwet\project101\README.md# DalalScope
