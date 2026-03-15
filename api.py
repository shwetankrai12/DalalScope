from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional
import json

from resolver import resolve_ticker
from fetcher import fetch_ohlcv, fetch_news

app = FastAPI(title="NSE Market Dashboard API")

# Setup CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

        # Convert DataFrame to a list of dicts corresponding to rows
        records = json.loads(data.to_json(orient='records'))
        return records
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/resolve")
async def resolve_company(company: str):
    """Resolves a company name to its NSE ticker symbol."""
    try:
        ticker = resolve_ticker(company)
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Could not resolve company name '{company}'.")
            
        return {
            "ticker": ticker,
            "company": company
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port)
