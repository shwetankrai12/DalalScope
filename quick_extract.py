"""Quick value extraction examples for OHLCV data"""

import pandas as pd

# Quick examples of extracting values from CSV

# 1. Read CSV and get basic values
df = pd.read_csv('MSFT_ohlcv.csv')

# Get single values
latest_price = df['Close'].iloc[-1]  # Last closing price
highest_price = df['High'].max()     # Highest price in period
lowest_price = df['Low'].min()       # Lowest price in period
total_volume = df['Volume'].sum()    # Total volume

print(f"Latest Price: ₹{latest_price:.2f}")
print(f"Highest: ₹{highest_price:.2f}")
print(f"Lowest: ₹{lowest_price:.2f}")
print(f"Total Volume: {total_volume:,}")

# 2. Get all values as lists
dates = df['Date'].tolist()
closes = df['Close'].tolist()
volumes = df['Volume'].tolist()

print(f"\nFirst 3 dates: {dates[:3]}")
print(f"First 3 closes: {closes[:3]}")

# 3. Get specific day's data
specific_day = df[df['Date'] == '2025-12-02']
if not specific_day.empty:
    day_data = specific_day.iloc[0]
    print(f"\n2025-12-02 Data:")
    print(f"Open: ₹{day_data['Open']:.2f}")
    print(f"Close: ₹{day_data['Close']:.2f}")
    print(f"Volume: {day_data['Volume']:,}")

# 4. Calculate simple metrics
avg_close = df['Close'].mean()
avg_volume = df['Volume'].mean()

print(f"\nAverage Close: ₹{avg_close:.2f}")
print(f"Average Volume: {avg_volume:,.0f}")

# 5. Find best/worst days
best_day = df.loc[df['Close'].idxmax()]
worst_day = df.loc[df['Close'].idxmin()]

print(f"\nBest day: {best_day['Date']} - ₹{best_day['Close']:.2f}")
print(f"Worst day: {worst_day['Date']} - ₹{worst_day['Close']:.2f}")

# 6. Extract data for plotting or further analysis
ohlc_data = {
    'dates': df['Date'].tolist(),
    'open': df['Open'].tolist(),
    'high': df['High'].tolist(),
    'low': df['Low'].tolist(),
    'close': df['Close'].tolist(),
    'volume': df['Volume'].tolist()
}

print(f"\nExtracted {len(ohlc_data['dates'])} days of OHLCV data")