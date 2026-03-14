"""Simple examples for extracting values from OHLCV CSV files"""

import pandas as pd

# Method 1: Basic CSV reading and value extraction
def simple_extraction(csv_file):
    """Simple way to extract common values"""
    df = pd.read_csv(csv_file)

    # Get latest closing price
    latest_close = df['Close'].iloc[-1]
    print(f"Latest closing price: ₹{latest_close:.2f}")

    # Get all closing prices as a list
    all_closes = df['Close'].tolist()
    print(f"All closing prices: {all_closes}")

    # Get highest and lowest prices
    highest = df['High'].max()
    lowest = df['Low'].min()
    print(f"Highest price: ₹{highest:.2f}")
    print(f"Lowest price: ₹{lowest:.2f}")

    # Get total volume
    total_volume = df['Volume'].sum()
    print(f"Total volume: {total_volume:,}")

    return df

# Method 2: Extract specific day's data
def get_specific_day_data(csv_file, date):
    """Get OHLCV data for a specific date"""
    df = pd.read_csv(csv_file)

    # Find data for specific date
    day_data = df[df['Date'] == date]

    if not day_data.empty:
        data = day_data.iloc[0]
        print(f"Data for {date}:")
        print(f"  Open: ₹{data['Open']:.2f}")
        print(f"  High: ₹{data['High']:.2f}")
        print(f"  Low: ₹{data['Low']:.2f}")
        print(f"  Close: ₹{data['Close']:.2f}")
        print(f"  Volume: {data['Volume']:,}")
        return data
    else:
        print(f"No data found for date: {date}")
        return None

# Method 3: Calculate price movements
def calculate_price_changes(csv_file):
    """Calculate daily price changes and percentage movements"""
    df = pd.read_csv(csv_file)

    # Calculate absolute change
    df['Change'] = df['Close'] - df['Open']

    # Calculate percentage change
    df['Percent_Change'] = (df['Change'] / df['Open']) * 100

    print("Daily price movements:")
    for _, row in df.iterrows():
        change_symbol = "+" if row['Change'] >= 0 else ""
        percent_symbol = "+" if row['Percent_Change'] >= 0 else ""
        print(f"{row['Date']}: {change_symbol}{row['Change']:.2f} ({percent_symbol}{row['Percent_Change']:.2f}%)")

    return df

# Method 4: Extract data for analysis
def extract_for_analysis(csv_file):
    """Extract data in formats useful for further analysis"""
    df = pd.read_csv(csv_file)

    # Convert to dictionary
    data_dict = {
        'dates': df['Date'].tolist(),
        'opens': df['Open'].tolist(),
        'highs': df['High'].tolist(),
        'lows': df['Low'].tolist(),
        'closes': df['Close'].tolist(),
        'volumes': df['Volume'].tolist()
    }

    print("Data extracted as dictionary:")
    print(f"Number of trading days: {len(data_dict['dates'])}")
    print(f"Date range: {data_dict['dates'][0]} to {data_dict['dates'][-1]}")
    print(f"Closing prices range: ₹{min(data_dict['closes']):.2f} - ₹{max(data_dict['closes']):.2f}")

    return data_dict

if __name__ == "__main__":
    csv_file = "MSFT_ohlcv.csv"

    print("=== Method 1: Basic Extraction ===")
    df = simple_extraction(csv_file)
    print()

    print("=== Method 2: Specific Day Data ===")
    get_specific_day_data(csv_file, "2025-12-02")
    print()

    print("=== Method 3: Price Changes ===")
    calculate_price_changes(csv_file)
    print()

    print("=== Method 4: Data for Analysis ===")
    data_dict = extract_for_analysis(csv_file)