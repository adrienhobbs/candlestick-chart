# Getting Started with the Indicator System

This guide will help you understand and use the indicator system in your trading chart application.

## What is the Indicator System?

The indicator system allows you to add technical analysis indicators to your trading charts. Indicators help analyze price movements and identify trading opportunities.

## Using Indicators

### Adding Indicators

1. Click the **"Add Indicator"** button in the header
2. Browse available indicators by category (Trend, Momentum, Volatility, etc.)
3. Use the search bar to find specific indicators
4. Click the **"Add"** button on any indicator to add it to your chart

### Configuring Indicators

Each indicator comes with customizable settings:

1. Find the indicator in the **"Indicators"** panel
2. Click the **settings icon** (gear) next to the indicator name
3. Adjust the settings:
   - **Period**: Number of bars used in calculations
   - **Colors**: Line colors for visual customization
   - **Line Width**: Thickness of indicator lines
   - **Other settings**: Indicator-specific parameters
4. Click **"Save Changes"** to apply

### Multiple Instances

You can add multiple instances of the same indicator with different settings. For example:
- SMA(1) with period 20
- SMA(2) with period 50
- SMA(3) with period 200

Each instance is automatically numbered and can be configured independently.

### Removing Indicators

1. Find the indicator in the **"Indicators"** panel
2. Click the **trash icon** next to the indicator name
3. The indicator is immediately removed from the chart

## Built-in Indicators

### SMA (Simple Moving Average)
- **Category**: Trend
- **Description**: Smooths price data by averaging over a period
- **Settings**: Period, Color, Line Width
- **Use Case**: Identify trend direction and support/resistance levels

### EMA (Exponential Moving Average)
- **Category**: Trend
- **Description**: Gives more weight to recent prices
- **Settings**: Period, Color, Line Width
- **Use Case**: More responsive to recent price changes than SMA

### RSI (Relative Strength Index)
- **Category**: Momentum
- **Description**: Measures speed and magnitude of price changes
- **Settings**: Period, Color, Line Width
- **Use Case**: Identify overbought (>70) and oversold (<30) conditions

### Bollinger Bands
- **Category**: Volatility
- **Description**: Volatility bands above and below a moving average
- **Settings**: Period, Standard Deviation, Upper/Middle/Lower Colors, Line Width
- **Use Case**: Identify volatility and potential price breakouts

## Persistence

Indicators are automatically saved based on your persistence configuration:

- **With Supabase**: Indicators sync across devices when logged in
- **With localStorage**: Indicators persist locally in your browser
- **Disabled**: Indicators reset when you refresh the page

## Tips

- Start with common indicators like SMA(20) and SMA(50) to identify trends
- Use RSI to find potential entry and exit points
- Bollinger Bands help identify volatility and price extremes
- Combine multiple indicators for better analysis
- Don't overcrowd your chart - use 2-4 indicators maximum for clarity

## Next Steps

- Learn how to [create custom indicators](./creating-indicators.md)
- Explore the [architecture documentation](./architecture.md)
- Check out the [API reference](./api-reference.md)
