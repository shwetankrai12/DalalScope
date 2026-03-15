from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import json

from resolver import resolve_ticker
from fetcher import fetch_ohlcv, fetch_news

app = FastAPI(title="NSE Market Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models for Portfolio ─────────────────────────────────────────────

class Holding(BaseModel):
    ticker: str           # e.g. "TCS.NS"
    company_name: str     # e.g. "Tata Consultancy Services"
    qty: float            # number of shares
    avg_buy_price: float  # average purchase price in ₹


class RefreshRequest(BaseModel):
    tickers: List[str]    # list of tickers to refresh prices for


# ── Existing endpoints ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/stock/latest")
async def get_latest(ticker: str):
    """Fetches the latest trading day OHLCV."""
    try:
        ticker = ticker.upper()
        if not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        data = fetch_ohlcv(ticker, mode="latest")
        if data.empty:
            raise HTTPException(status_code=404, detail="Data not found for ticker.")

        latest = data.iloc[-1]
        return {
            "ticker": ticker,
            "date": latest["Date"],
            "open": float(latest["Open"]),
            "high": float(latest["High"]),
            "low": float(latest["Low"]),
            "close": float(latest["Close"]),
            "volume": int(latest["Volume"])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/history")
async def get_history(ticker: str, start: str, end: str):
    """Fetches historical OHLCV data for a date range."""
    try:
        ticker = ticker.upper()
        if not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        data = fetch_ohlcv(ticker, mode="history", start=start, end=end)
        if data.empty:
            raise HTTPException(status_code=404, detail="No historical data found for the given range.")

        records = json.loads(data.to_json(orient='records'))
        return records
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/resolve")
async def resolve_company(company: str):
    """Resolves a company name to its NSE ticker symbol."""
    try:
        ticker = resolve_ticker(company)
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Could not resolve company name '{company}'.")
        return {"ticker": ticker, "company": company}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/news")
async def get_stock_news(ticker: str):
    """Returns news headlines + sentiment for a given NSE ticker."""
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker parameter is required")

    ticker = ticker.upper()
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"

    data = fetch_news(ticker)
    if "error" in data and not data["headlines"]:
        raise HTTPException(status_code=503, detail=f"News fetch failed: {data['error']}")
    return data


# ── Portfolio endpoints ────────────────────────────────────────────────────────

@app.post("/api/portfolio/prices")
async def get_portfolio_prices(req: RefreshRequest):
    """
    Batch-fetch latest close prices for a list of tickers.
    Called by the frontend to refresh portfolio P&L.

    Request body:  { "tickers": ["TCS.NS", "RELIANCE.NS", "INFY.NS"] }
    Response:      { "TCS.NS": 3821.50, "RELIANCE.NS": 2915.75, ... }
    Tickers that fail (delisted, bad symbol) return null so the frontend
    can show a warning instead of crashing.
    """
    results = {}
    for raw in req.tickers:
        ticker = raw.upper()
        if not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"
        try:
            data = fetch_ohlcv(ticker, mode="latest")
            if data.empty:
                results[ticker] = None
            else:
                results[ticker] = float(data.iloc[-1]["Close"])
        except Exception:
            results[ticker] = None
    return results


@app.get("/api/portfolio/quote/{ticker}")
async def get_single_quote(ticker: str):
    """
    Lightweight quote for a single ticker — used when user adds a new
    holding to auto-fill the current price field.

    Response: { "ticker": "TCS.NS", "close": 3821.50, "date": "2025-03-14" }
    """
    ticker = ticker.upper()
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"
    try:
        data = fetch_ohlcv(ticker, mode="latest")
        if data.empty:
            raise HTTPException(status_code=404, detail=f"No data for {ticker}")
        latest = data.iloc[-1]
        return {
            "ticker": ticker,
            "close": float(latest["Close"]),
            "date": latest["Date"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port)