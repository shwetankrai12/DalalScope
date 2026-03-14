"""Output formatting and file saving functions."""

import pandas as pd
from tabulate import tabulate
from pathlib import Path
from typing import Optional


def print_table(
    ticker: str,
    company_name: Optional[str],
    data: pd.DataFrame,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> None:
    """
    Print OHLCV data as a formatted table to console.
    
    Args:
        ticker: The stock ticker symbol
        company_name: The company name (optional)
        data: DataFrame with OHLCV data
        start_date: Start date of the period (optional)
        end_date: End date of the period (optional)
    """
    # Print header information
    header = f"NSE Ticker: {ticker}"
    if company_name:
        header += f" | Company: {company_name}"
    print(header)
    
    # Print period information if provided
    if start_date and end_date:
        print(f"Period: {start_date} to {end_date}")
    elif not data.empty:
        first_date = data.iloc[0]["Date"]
        last_date = data.iloc[-1]["Date"]
        print(f"Period: {first_date} to {last_date}")
    
    print()
    
    # Print the table
    print(tabulate(data, headers="keys", tablefmt="grid", showindex=False))
    print()


def save_to_csv(
    ticker: str,
    data: pd.DataFrame,
    output_dir: str = "."
) -> str:
    """
    Save OHLCV data to a CSV file.
    
    Args:
        ticker: The stock ticker symbol
        data: DataFrame with OHLCV data
        output_dir: Directory to save the CSV file (default: current directory)
    
    Returns:
        The full path to the saved CSV file
    
    Raises:
        Exception: If the file cannot be written
    """
    try:
        output_path = Path(output_dir) / f"{ticker}_ohlcv.csv"
        data.to_csv(output_path, index=False)
        return str(output_path)
    except Exception as e:
        raise Exception(f"Failed to save CSV file: {e}")


def print_analysis(data: pd.DataFrame) -> None:
    """
    Print basic analysis of the extracted OHLCV data.
    
    Args:
        data: DataFrame with OHLCV data
    """
    if data.empty:
        return

    print("=== Data Analysis ===")
    
    # Latest close
    latest_close = data['Close'].iloc[-1]
    print(f"Latest closing price: ₹{latest_close:.2f}")

    # Extreme prices
    highest = data['High'].max()
    lowest = data['Low'].min()
    print(f"Highest price: ₹{highest:.2f}")
    print(f"Lowest price: ₹{lowest:.2f}")

    # Averages
    avg_close = data['Close'].mean()
    avg_volume = data['Volume'].mean()
    print(f"Average closing price: ₹{avg_close:.2f}")
    print(f"Average volume: {avg_volume:,.0f}")
    
    # Total volume
    total_volume = data['Volume'].sum()
    print(f"Total volume: {total_volume:,}")
    print()
