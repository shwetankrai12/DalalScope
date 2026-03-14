"""OHLCV data fetcher using yfinance."""

import pandas as pd
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
    
    # Import yfinance locally to prevent blocking app startup time
    import yfinance as yf
    
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
