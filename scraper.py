"""Stock Market Company Data Scraper - Main Entry Point."""

import argparse
import sys
from typing import Optional

from resolver import resolve_ticker
from fetcher import fetch_ohlcv
from output import print_table, save_to_csv, print_analysis


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="Fetch and display OHLCV NSE stock market data for a company.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scraper.py --company "Tata Consultancy Services" --mode history --start 2024-01-01 --end 2024-12-31
  python scraper.py --ticker TCS --mode latest
  python scraper.py --company "Reliance Industries" --mode latest
        """
    )
    
    # Add mutually exclusive group for company name or ticker
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--company",
        type=str,
        help="Company name (e.g., 'Tata Consultancy Services', 'Reliance Industries')"
    )
    input_group.add_argument(
        "--ticker",
        type=str,
        help="NSE stock ticker symbol (e.g., 'TCS', 'RELIANCE')"
    )
    
    # Add mode argument
    parser.add_argument(
        "--mode",
        choices=["latest", "history"],
        default="latest",
        help="Fetch mode: 'latest' for most recent trading day or 'history' for date range (default: latest)"
    )
    
    # Add date arguments (required for history mode)
    parser.add_argument(
        "--start",
        type=str,
        help="Start date in YYYY-MM-DD format (required for history mode)"
    )
    parser.add_argument(
        "--end",
        type=str,
        help="End date in YYYY-MM-DD format (required for history mode)"
    )
    
    # Add output directory argument
    parser.add_argument(
        "--output",
        type=str,
        default=".",
        help="Directory to save CSV file (default: current directory)"
    )
    
    # Add analysis flag
    parser.add_argument(
        "--analyze",
        action="store_true",
        help="Print basic analysis of the scraped data (e.g. max/min price, total volume)"
    )
    
    args = parser.parse_args()
    
    try:
        # Resolve ticker if company name provided
        if args.company:
            print(f"Resolving NSE ticker for '{args.company}'...", file=sys.stderr)
            ticker = resolve_ticker(args.company)
            if not ticker:
                print(f"Error: Could not resolve company name '{args.company}' to an NSE ticker symbol.", file=sys.stderr)
                print("Please try a different company name or provide a ticker symbol directly.", file=sys.stderr)
                sys.exit(1)
            company_name = args.company
            print(f"Found NSE ticker: {ticker}", file=sys.stderr)
        else:
            ticker = args.ticker.upper()
            company_name = None
        
        # Append .NS suffix if not already present
        if not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"
        
        # Validate dates for history mode
        if args.mode == "history":
            if not args.start or not args.end:
                print("Error: For 'history' mode, both --start and --end dates are required.", file=sys.stderr)
                print("Example: python scraper.py --ticker AAPL --mode history --start 2024-01-01 --end 2024-12-31", file=sys.stderr)
                sys.exit(1)
        
        # Fetch OHLCV data
        print(f"Fetching {args.mode} OHLCV data for {ticker}...", file=sys.stderr)
        data = fetch_ohlcv(ticker, mode=args.mode, start=args.start, end=args.end)
        
        if data.empty:
            print(f"Warning: No data found for ticker '{ticker}'", file=sys.stderr)
            sys.exit(1)
        
        # Print table to console
        print()
        print_table(ticker, company_name, data, args.start, args.end)
        
        # Print basic analysis if requested
        if args.analyze:
            print_analysis(data)
        
        # Save to CSV
        csv_path = save_to_csv(ticker, data, args.output)
        print(f"Saved to: {csv_path}")
        
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()