import yfinance as yf
import pandas as pd
import numpy as np
from pypfopt import EfficientFrontier, risk_models, expected_returns
from pypfopt.discrete_allocation import DiscreteAllocation, get_latest_prices


def get_historical_prices(tickers: list[str], period: str = "1y") -> pd.DataFrame:
    """
    Fetch 1-year historical closing prices for given tickers.
    Tickers should be NSE format: e.g. ["INFY.NS", "TCS.NS"]
    """
    data = yf.download(tickers, period=period, auto_adjust=True, timeout=10)["Close"]
    data.dropna(how="all", inplace=True)
    return data


def run_optimization(holdings: list[dict]) -> dict:
    """
    Main function. Takes user holdings and returns optimization results.

    holdings format:
    [
        {"ticker": "INFY.NS", "qty": 10, "avg_buy_price": 1200},
        {"ticker": "TCS.NS",  "qty": 5,  "avg_buy_price": 3500},
        ...
    ]

    Returns a dict with:
    - current_weights
    - optimized_weights
    - sharpe_ratio (current vs optimized)
    - diversification_score
    - sector_concentration
    - suggestions (list of plain English strings)
    """

    tickers = [h["ticker"] for h in holdings]

    # --- 1. Fetch historical prices ---
    prices = get_historical_prices(tickers)

    # Drop tickers that failed to fetch
    valid_tickers = [t for t in tickers if t in prices.columns]
    if len(valid_tickers) < 2:
        return {"error": "Need at least 2 valid tickers to optimize."}

    prices = prices[valid_tickers]

    # --- 2. Calculate current portfolio value & weights ---
    holding_map = {h["ticker"]: h for h in holdings}
    latest_prices = get_latest_prices(prices)

    current_values = {}
    for ticker in valid_tickers:
        qty = holding_map[ticker]["qty"]
        price = float(latest_prices[ticker])
        current_values[ticker] = qty * price

    total_value = sum(current_values.values())
    current_weights = {t: round(v / total_value, 4) for t, v in current_values.items()}

    # --- 3. Expected returns & covariance matrix (core MPT math) ---
    mu = expected_returns.mean_historical_return(prices)   # annualized mean returns
    cov = risk_models.sample_cov(prices)                   # covariance matrix

    # --- 4. Optimize for Maximum Sharpe Ratio ---
    ef = EfficientFrontier(mu, cov)
    ef.add_constraint(lambda w: w >= 0.05)   # min 5% per stock
    ef.add_constraint(lambda w: w <= 0.40)   # max 40% per stock (concentration cap)
    
    try:
        ef.max_sharpe(risk_free_rate=0.065)  # 6.5% RBI risk-free rate
        optimized_weights = ef.clean_weights()
        perf = ef.portfolio_performance(risk_free_rate=0.065, verbose=False)
        optimized_sharpe = round(perf[2], 3)
    except Exception:
        # Fallback: equal weight if optimization fails
        n = len(valid_tickers)
        optimized_weights = {t: round(1/n, 4) for t in valid_tickers}
        optimized_sharpe = None

    # --- 5. Calculate current Sharpe ratio ---
    current_sharpe = _calculate_current_sharpe(prices, current_weights)

    # --- 6. Diversification score (0-100) ---
    diversification_score = _calc_diversification_score(current_weights)

    # --- 7. Sector concentration (simple heuristic grouping) ---
    sector_map = _get_sector_map(valid_tickers)
    sector_concentration = _calc_sector_concentration(current_weights, sector_map)

    # --- 8. Generate plain English suggestions ---
    suggestions = _generate_suggestions(
        current_weights,
        optimized_weights,
        current_sharpe,
        optimized_sharpe,
        diversification_score,
        sector_concentration
    )

    return {
        "total_portfolio_value": round(total_value, 2),
        "current_weights": {t: round(w * 100, 2) for t, w in current_weights.items()},
        "optimized_weights": {t: round(w * 100, 2) for t, w in optimized_weights.items()},
        "current_sharpe": current_sharpe,
        "optimized_sharpe": optimized_sharpe,
        "diversification_score": diversification_score,
        "sector_concentration": sector_concentration,
        "suggestions": suggestions,
        "valid_tickers": valid_tickers
    }


def _calculate_current_sharpe(prices: pd.DataFrame, weights: dict) -> float:
    """Calculate Sharpe ratio of user's actual current portfolio."""
    try:
        returns = prices.pct_change().dropna()
        w = np.array([weights.get(t, 0) for t in prices.columns])
        port_return = returns.dot(w)
        annualized_return = port_return.mean() * 252
        annualized_vol = port_return.std() * np.sqrt(252)
        sharpe = (annualized_return - 0.065) / annualized_vol
        return round(float(sharpe), 3)
    except Exception:
        return None


def _calc_diversification_score(weights: dict) -> int:
    """
    Score from 0-100.
    Based on Herfindahl-Hirschman Index (HHI) — lower HHI = more diversified.
    """
    hhi = sum(w**2 for w in weights.values())
    # HHI ranges from 1/n (perfect diversification) to 1 (single stock)
    n = len(weights)
    min_hhi = 1 / n
    score = int((1 - (hhi - min_hhi) / (1 - min_hhi)) * 100)
    return max(0, min(100, score))


def _get_sector_map(tickers: list[str]) -> dict:
    """
    Simple hardcoded sector map for common NSE stocks.
    Extend this dict as needed.
    """
    sectors = {
        "INFY.NS": "IT", "TCS.NS": "IT", "WIPRO.NS": "IT",
        "HCLTECH.NS": "IT", "TECHM.NS": "IT", "LTIM.NS": "IT",
        "RELIANCE.NS": "Energy", "ONGC.NS": "Energy", "NTPC.NS": "Energy",
        "HDFCBANK.NS": "Banking", "ICICIBANK.NS": "Banking", "SBIN.NS": "Banking",
        "AXISBANK.NS": "Banking", "KOTAKBANK.NS": "Banking", "BAJFINANCE.NS": "Banking",
        "HINDUNILVR.NS": "FMCG", "ITC.NS": "FMCG", "NESTLEIND.NS": "FMCG",
        "SUNPHARMA.NS": "Pharma", "DRREDDY.NS": "Pharma", "CIPLA.NS": "Pharma",
        "TATAMOTORS.NS": "Auto", "MARUTI.NS": "Auto", "BAJAJ-AUTO.NS": "Auto",
        "TATASTEEL.NS": "Metals", "JSWSTEEL.NS": "Metals", "HINDALCO.NS": "Metals",
    }
    return {t: sectors.get(t, "Other") for t in tickers}


def _calc_sector_concentration(weights: dict, sector_map: dict) -> dict:
    """Group weights by sector and return sector-wise allocation %."""
    sector_totals = {}
    for ticker, weight in weights.items():
        sector = sector_map.get(ticker, "Other")
        sector_totals[sector] = sector_totals.get(sector, 0) + weight
    return {s: round(w * 100, 2) for s, w in sector_totals.items()}


def _generate_suggestions(
    current_weights, optimized_weights,
    current_sharpe, optimized_sharpe,
    diversification_score, sector_concentration
) -> list[str]:
    """Generate plain English suggestions based on analysis."""
    suggestions = []

    # 1. Diversification feedback
    if diversification_score >= 75:
        suggestions.append(
            f"✅ Your portfolio is well-diversified (score: {diversification_score}/100)."
        )
    elif diversification_score >= 50:
        suggestions.append(
            f"⚠️ Moderate diversification (score: {diversification_score}/100). "
            "Consider spreading across more sectors."
        )
    else:
        suggestions.append(
            f"🔴 Poor diversification (score: {diversification_score}/100). "
            "You are heavily concentrated in very few stocks."
        )

    # 2. Sector over-concentration warning
    for sector, pct in sector_concentration.items():
        if pct > 50:
            suggestions.append(
                f"🔴 {sector} sector makes up {pct}% of your portfolio — too concentrated. "
                f"Consider reducing exposure below 40%."
            )
        elif pct > 35:
            suggestions.append(
                f"⚠️ {sector} sector is {pct}% of your portfolio. "
                "Slightly high — consider balancing with other sectors."
            )

    # 3. Sharpe ratio comparison
    if current_sharpe and optimized_sharpe:
        if optimized_sharpe > current_sharpe + 0.1:
            suggestions.append(
                f"📈 Optimized allocation improves your Sharpe ratio from "
                f"{current_sharpe} → {optimized_sharpe}. "
                "Rebalancing recommended for better risk-adjusted returns."
            )
        else:
            suggestions.append(
                f"✅ Your current allocation (Sharpe: {current_sharpe}) is "
                f"close to optimal (Sharpe: {optimized_sharpe}). Minor rebalancing needed."
            )

    # 4. Weight adjustment suggestions
    for ticker in current_weights:
        curr = current_weights[ticker] * 100 if current_weights[ticker] <= 1 else current_weights[ticker]
        opt = optimized_weights.get(ticker, 0)
        opt = opt * 100 if opt <= 1 else opt
        diff = opt - curr
        if diff > 10:
            suggestions.append(
                f"📊 Consider increasing {ticker} from {curr:.1f}% → {opt:.1f}% "
                f"(+{diff:.1f}%) for better optimization."
            )
        elif diff < -10:
            suggestions.append(
                f"📊 Consider reducing {ticker} from {curr:.1f}% → {opt:.1f}% "
                f"({diff:.1f}%) to reduce concentration risk."
            )

    return suggestions
