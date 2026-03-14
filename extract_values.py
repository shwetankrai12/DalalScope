"""Example: How to extract values from OHLCV CSV files"""

import pandas as pd

def extract_values_from_csv(csv_file_path):
    """Extract and manipulate OHLCV data from CSV file"""

    # Read the CSV file
    df = pd.read_csv(csv_file_path)

    # Display basic info
    print("Data Overview:")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
    print()

    # Extract specific values
    print("=== Extracting Specific Values ===")

    # Get all closing prices
    closing_prices = df['Close'].tolist()
    print(f"All closing prices: {closing_prices}")

    # Get latest closing price
    latest_close = df['Close'].iloc[-1]
    print(f"Latest closing price: {latest_close}")

    # Get highest closing price
    max_close = df['Close'].max()
    print(f"Highest closing price: {max_close}")

    # Get lowest closing price
    min_close = df['Close'].min()
    print(f"Lowest closing price: {min_close}")

    # Get average closing price
    avg_close = df['Close'].mean()
    print(f"Average closing price: {avg_close:.2f}")

    print()

    # Extract volume data
    print("=== Volume Analysis ===")
    total_volume = df['Volume'].sum()
    avg_volume = df['Volume'].mean()
    max_volume = df['Volume'].max()

    print(f"Total volume: {total_volume:,}")
    print(f"Average daily volume: {avg_volume:,.0f}")
    print(f"Highest daily volume: {max_volume:,}")

    print()

    # Extract OHLC data for a specific date
    print("=== OHLC Data for Latest Day ===")
    latest_data = df.iloc[-1]
    print(f"Date: {latest_data['Date']}")
    print(f"Open: {latest_data['Open']}")
    print(f"High: {latest_data['High']}")
    print(f"Low: {latest_data['Low']}")
    print(f"Close: {latest_data['Close']}")
    print(f"Volume: {latest_data['Volume']:,}")

    print()

    # Calculate daily price changes
    print("=== Daily Price Changes ===")
    df['Price_Change'] = df['Close'] - df['Open']
    df['Percent_Change'] = (df['Price_Change'] / df['Open']) * 100

    print("Daily changes:")
    for idx, row in df.iterrows():
        print(f"{row['Date']}: {row['Price_Change']:+.2f} ({row['Percent_Change']:+.2f}%)")

    print()

    # Find trading days with highest/lowest prices
    print("=== Extreme Price Days ===")
    highest_day = df.loc[df['High'].idxmax()]
    lowest_day = df.loc[df['Low'].idxmin()]

    print(f"Day with highest price: {highest_day['Date']} - High: {highest_day['High']}")
    print(f"Day with lowest price: {lowest_day['Date']} - Low: {lowest_day['Low']}")

    return df

# Example usage
if __name__ == "__main__":
    # Replace with your actual CSV file path
    csv_file = "MSFT_ohlcv.csv"
    data = extract_values_from_csv(csv_file)

    print("\n=== Raw DataFrame ===")
    print(data.head())