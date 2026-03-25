from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from datetime import date as DateType
import json
import os
import sys

# Inject the backend directory into sys.path to ensure 'import fetcher' resolves
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from resolver import resolve_ticker
from fetcher import fetch_ohlcv, fetch_news
from optimizer import run_optimization

app = FastAPI(title="NSE Market Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Supabase admin client ─────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase_admin = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


import httpx

async def get_current_user(request: Request) -> str:
    """Extracts and validates the Supabase JWT from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")

    token = auth_header.replace("Bearer ", "")
    if not SUPABASE_URL:
        raise HTTPException(status_code=503, detail="Auth service not configured — set SUPABASE_URL in environment.")

    # We use a manual httpx validation against the GoTrue API instead of
    # `supabase_admin.auth.get_user` because the local tokens do not
    # conform to Python's local JWT formatting validation and crash.
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": os.environ.get("SUPABASE_ANON_KEY") 
                }
            )
            if r.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            user_data = r.json()
            return user_data.get("id")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")

# ── Pydantic models ───────────────────────────────────────────────────────────

class Holding(BaseModel):
    ticker: str
    company_name: str
    qty: float
    avg_buy_price: float


class RefreshRequest(BaseModel):
    tickers: List[str]


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[DateType] = None
    city: Optional[str] = None
    risk_appetite: Optional[str] = None


class PortfolioRequest(BaseModel):
    holdings: List[Holding]


# ── Stock endpoints ────────────────────────────────────────────────────────────

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join(STATIC_DIR, "favicon.ico"))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/stock/latest")
async def get_latest(ticker: str):
    """Fetches the latest trading day OHLCV.
    Supports NSE stocks (auto-appends .NS) and index tickers like ^NSEI, ^BSESN.
    """
    try:
        ticker = ticker.upper()
        # Index tickers start with ^ — skip .NS append
        if not ticker.startswith("^") and not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        data = fetch_ohlcv(ticker, mode="latest")
        if data.empty:
            raise HTTPException(status_code=404, detail="Data not found for ticker.")

        latest = data.iloc[-1]
        prev_close = float(data.iloc[-2]["Close"]) if len(data) >= 2 else None

        return {
            "ticker": ticker,
            "date": latest["Date"],
            "open": float(latest["Open"]),
            "high": float(latest["High"]),
            "low": float(latest["Low"]),
            "close": float(latest["Close"]),
            "volume": int(latest["Volume"]),
            "prev_close": prev_close,
        }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "No data available" in error_msg or "not found" in error_msg.lower() or "empty" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


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
        error_msg = str(e).lower()
        if any(x in error_msg for x in ["no data", "not found", "empty", "symbol may be delisted", "failed to download"]):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/intraday")
async def get_intraday(
    ticker: str,
    interval: str = "5m",
    period: str = "1d"
):
    """
    Fetches intraday OHLCV candles for a ticker.

    Parameters:
        ticker   — NSE stock symbol (e.g. RELIANCE)
        interval — candle size: 1m, 2m, 5m, 15m, 30m, 60m  (default: 5m)
        period   — lookback: 1d, 2d, 5d                     (default: 1d)

    Returns list of { Date, Open, High, Low, Close, Volume }
    where Date is ISO timestamp string.
    """
    try:
        ticker = ticker.upper()
        if not ticker.startswith("^") and not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        data = fetch_ohlcv(ticker, mode="intraday", interval=interval, period=period)
        if data.empty:
            raise HTTPException(status_code=404, detail="No intraday data found.")

        records = json.loads(data.to_json(orient="records"))
        return records

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sparkline")
async def get_sparkline(symbol: str):
    """
    Fetches the last 7 closing prices for a sparkline chart.
    Tries intraday mode first, falls back to history mode if that fails.
    """
    try:
        ticker = symbol.upper()
        if not ticker.startswith("^") and not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        data = None

        # Try intraday mode first (7 trading days)
        try:
            data = fetch_ohlcv(ticker, mode="intraday", interval="1d", period="7d")
        except Exception:
            pass

        # Fallback: use history mode with explicit date range (last 14 calendar days)
        if data is None or data.empty:
            from datetime import date, timedelta
            end_d = date.today()
            start_d = end_d - timedelta(days=14)
            try:
                data = fetch_ohlcv(ticker, mode="history",
                                   start=start_d.isoformat(), end=end_d.isoformat())
            except Exception:
                pass

        if data is None or data.empty:
            raise HTTPException(status_code=404, detail=f"No sparkline data found for '{ticker}'.")

        prices = data["Close"].tail(7).tolist()
        return {"symbol": ticker, "prices": prices}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Index History for Metrics Chart ────────────────────────────────────────────

INDEX_MAP = {
    "NIFTY50": "^NSEI",
    "SENSEX": "^BSESN",
    "BANKNIFTY": "^NSEBANK",
    "INDIAVIX": "^INDIAVIX",
}

@app.get("/api/index-history")
async def get_index_history(symbol: str = "NIFTY50", days: int = 30):
    """
    Fetches historical closing prices for a market index.
    Returns { labels: ["01 Feb", ...], values: [21800, ...] }
    """
    from datetime import datetime, timedelta

    try:
        ticker = INDEX_MAP.get(symbol.upper())
        if not ticker:
            raise HTTPException(status_code=400, detail=f"Unknown index: {symbol}. Use one of: {list(INDEX_MAP.keys())}")

        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days + 5)).strftime("%Y-%m-%d")

        data = fetch_ohlcv(ticker, mode="history", start=start_date, end=end_date)
        if data.empty:
            raise HTTPException(status_code=404, detail="No history data found.")

        labels = []
        values = []
        for _, row in data.iterrows():
            date_val = row.get("Date", "")
            try:
                if hasattr(date_val, 'strftime'):
                    labels.append(date_val.strftime("%d %b"))
                else:
                    dt_str = str(date_val)
                    if "T" in dt_str:
                        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    else:
                        dt = datetime.strptime(dt_str[:10], "%Y-%m-%d")
                    labels.append(dt.strftime("%d %b"))
            except Exception:
                labels.append(str(date_val)[:10])
            values.append(round(float(row["Close"]), 2))

        # Trim to requested day count
        if len(labels) > days:
            labels = labels[-days:]
            values = values[-days:]

        return {"symbol": symbol, "labels": labels, "values": values}

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
async def get_stock_news(ticker: str, days: str = "7"):
    """Returns news headlines + sentiment for a given NSE ticker, optionally filtered by days."""
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker parameter is required")

    ticker = ticker.upper()
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"

    data = fetch_news(ticker, days=days)
    if "error" in data and not data["headlines"]:
        raise HTTPException(status_code=503, detail=f"News fetch failed: {data['error']}")
    return data


# ── Holdings endpoints ────────────────────────────────────────────────────────

@app.get("/api/holdings")
async def get_holdings(user_id: str = Depends(get_current_user)):
    result = supabase_admin.table("holdings").select("*").eq("user_id", user_id).execute()
    return result.data or []


@app.post("/api/holdings")
async def add_holding(holding: Holding, user_id: str = Depends(get_current_user)):
    data = holding.model_dump()
    data["user_id"] = user_id
    result = supabase_admin.table("holdings").insert(data).execute()
    return result.data[0] if result.data else {}


@app.delete("/api/holdings/{ticker}")
async def delete_holding(ticker: str, user_id: str = Depends(get_current_user)):
    supabase_admin.table("holdings").delete().eq("user_id", user_id).eq("ticker", ticker).execute()
    return {"ok": True}


@app.patch("/api/holdings/{ticker}")
async def update_holding(ticker: str, holding: Holding, user_id: str = Depends(get_current_user)):
    data = {"qty": holding.qty, "avg_buy_price": holding.avg_buy_price}
    result = supabase_admin.table("holdings").update(data).eq("user_id", user_id).eq("ticker", ticker).execute()
    return result.data[0] if result.data else {}


# ── Portfolio endpoints ────────────────────────────────────────────────────────

@app.post("/api/portfolio/prices")
async def get_portfolio_prices(req: RefreshRequest):
    """Batch-fetch latest close prices for a list of tickers."""
    results: dict[str, Optional[float]] = {}
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
    """Lightweight quote for a single ticker."""
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Portfolio Analysis ────────────────────────────────────────────────────────

@app.post("/api/portfolio/analyze")
async def analyze_portfolio(request: PortfolioRequest):
    """
    Accepts user's holdings and returns:
    - current vs optimized weights
    - Sharpe ratio comparison
    - diversification score
    - sector concentration
    - plain English suggestions
    """
    if len(request.holdings) < 2:
        raise HTTPException(
            status_code=400,
            detail="Add at least 2 stocks to run portfolio analysis."
        )

    for h in request.holdings:
        if not h.ticker.upper().endswith('.NS'):
            h.ticker = h.ticker.upper() + '.NS'

    holdings_data = [
        {
            "ticker": h.ticker,
            "qty": h.qty,
            "avg_buy_price": h.avg_buy_price
        }
        for h in request.holdings
    ]

    result = run_optimization(holdings_data)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return result


# ── Profile endpoints ─────────────────────────────────────────────────────────

@app.get("/api/profile")
async def get_profile(user_id: str = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    if not supabase_admin:
        raise HTTPException(status_code=503, detail="Auth service not configured.")
    try:
        result = (
            supabase_admin.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception as e:
        # Profile row may not exist yet for new users — return empty dict
        err_str = str(e).lower()
        if "no rows" in err_str or "pgrst116" in err_str:
            return {}
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/profile")
async def update_profile(
    profile: ProfileUpdate,
    user_id: str = Depends(get_current_user)
):
    """Updates profile fields for the authenticated user."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    data = {k: v for k, v in profile.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        # Convert date to string for Supabase
        if "date_of_birth" in data and data["date_of_birth"]:
            data["date_of_birth"] = str(data["date_of_birth"])

        # Include user id so upsert can match/insert the row
        data["id"] = user_id

        result = (
            supabase_admin.table("profiles")
            .upsert(data)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Static files & startup ────────────────────────────────────────────────────

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.api:app", host="0.0.0.0", port=port)