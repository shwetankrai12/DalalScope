"""OHLCV data fetcher using yfinance."""

import pandas as pd
import yfinance as yf
import urllib.parse
from datetime import datetime, date
from typing import Optional


def fetch_ohlcv(
    ticker: str,
    mode: str = "latest",
    start: Optional[str] = None,
    end: Optional[str] = None
) -> pd.DataFrame:
    """
    Fetch OHLCV data for a given ticker symbol.
    
    Args:
        ticker: The stock ticker symbol (e.g., "AAPL")
        mode: Fetch mode - 'latest' for most recent trading day or 'history' for date range
        start: Start date in YYYY-MM-DD format (required for 'history' mode)
        end: End date in YYYY-MM-DD format (required for 'history' mode)
    
    Returns:
        A pandas DataFrame with columns: Date, Open, High, Low, Close, Volume
    
    Raises:
        ValueError: If mode is invalid or required parameters are missing
        Exception: If data cannot be fetched for the ticker
    """
    if mode not in ["latest", "history"]:
        raise ValueError(f"Invalid mode '{mode}'. Must be 'latest' or 'history'.")
    
    try:
        # Download data using yfinance
        if mode == "latest":
            # Fetch the most recent trading day
            # We go back 7 days to ensure we get at least one trading day
            data = yf.download(ticker, period="7d", progress=False)
            
            # Get the most recent day
            if data.empty:
                raise Exception(f"No data available for ticker '{ticker}'")
            
            # Return only the last row
            data = data.tail(1)
        
        elif mode == "history":
            if not start or not end:
                raise ValueError("For 'history' mode, both 'start' and 'end' dates are required.")
            
            # Validate date format
            try:
                start_date = datetime.strptime(start, "%Y-%m-%d").date()
                end_date = datetime.strptime(end, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("Dates must be in YYYY-MM-DD format")
            
            if start_date > end_date:
                raise ValueError("Start date must be before end date")
            
            # Download historical data
            data = yf.download(ticker, start=start, end=end, progress=False)
            
            if data.empty:
                raise Exception(f"No data available for ticker '{ticker}' in the date range {start} to {end}")
        
        # Reset index to make Date a column instead of index
        data = data.reset_index()
        
        # Handle multi-level columns from yfinance (flatten if necessary)
        if isinstance(data.columns, pd.MultiIndex):
            # Flatten the multi-level columns
            data.columns = [col[0] if col[1] == '' else col[0] for col in data.columns.values]
        
        # Ensure Date column is properly formatted
        if "Date" in data.columns:
            data["Date"] = pd.to_datetime(data["Date"]).dt.strftime("%Y-%m-%d")
        
        # Select and reorder columns to standard OHLCV format
        data = data[["Date", "Open", "High", "Low", "Close", "Volume"]]
        
        # Round numeric columns to 2 decimal places (except Volume)
        for col in ["Open", "High", "Low", "Close"]:
            data[col] = data[col].round(2)
        
        data["Volume"] = data["Volume"].astype(int)
        
        return data
    
    except Exception as e:
        raise Exception(f"Error fetching data for '{ticker}': {e}")

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
        clean = word.strip(".,!?\"'()[]")
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
