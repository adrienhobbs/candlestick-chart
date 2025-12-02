# New Indicators Added

This document describes the 7 new technical indicators that were added to the trading chart application using the `fast-technical-indicators` library.

## Installation

The indicators use the `fast-technical-indicators` package, which has been installed as a dependency:

```bash
npm i fast-technical-indicators
```

## New Indicators

### 1. Stochastic Oscillator (Momentum)

**ID**: `stochastic`  
**Category**: Momentum  
**Display**: Separate pane

**Description**: Compares the closing price to the price range over a specified time period. Values range from 0-100, with readings above 80 indicating overbought conditions and below 20 indicating oversold conditions.

**Settings**:
- **Period (K)**: Number of bars for %K calculation (default: 14)
- **Signal Period (D)**: Number of bars for %D signal line (default: 3)
- **%K Line Color**: Color of the %K line (default: blue)
- **%D Line Color**: Color of the %D signal line (default: red)
- **Line Width**: Width of the indicator lines (default: 2)

**Output**: Two lines (%K and %D signal line)

**Use Case**: Identify overbought/oversold conditions and potential trend reversals

---

### 2. OBV - On-Balance Volume (Volume)

**ID**: `obv`  
**Category**: Volume  
**Display**: Separate pane

**Description**: Cumulative volume indicator that adds volume on up days and subtracts volume on down days. Used to confirm price trends and identify potential reversals.

**Settings**:
- **Line Color**: Color of the OBV line (default: green)
- **Line Width**: Width of the OBV line (default: 2)

**Output**: Single cumulative volume line

**Use Case**: Confirm price movements and identify divergences between price and volume

---

### 3. MFI - Money Flow Index (Volume)

**ID**: `mfi`  
**Category**: Volume  
**Display**: Separate pane

**Description**: Volume-weighted momentum indicator similar to RSI but incorporates volume. Values range from 0-100, with readings above 80 indicating overbought and below 20 indicating oversold.

**Settings**:
- **Period**: Number of bars for MFI calculation (default: 14)
- **Line Color**: Color of the MFI line (default: orange)
- **Line Width**: Width of the MFI line (default: 2)

**Output**: Single oscillator line (0-100 range)

**Use Case**: Identify overbought/oversold conditions with volume confirmation

---

### 4. Force Index (Volume)

**ID**: `forceindex`  
**Category**: Volume  
**Display**: Separate pane

**Description**: Measures the buying and selling pressure by combining price movement with volume. Positive values indicate bullish pressure, negative values indicate bearish pressure.

**Settings**:
- **Period**: Smoothing period for force index (default: 13)
- **Line Color**: Color of the Force Index line (default: purple)
- **Line Width**: Width of the Force Index line (default: 2)

**Output**: Single oscillator line

**Use Case**: Identify the strength of price movements and potential reversals

---

### 5. ATR - Average True Range (Volatility)

**ID**: `atr`  
**Category**: Volatility  
**Display**: Separate pane

**Description**: Measures market volatility by calculating the average of true ranges over a specified period. Higher values indicate higher volatility.

**Settings**:
- **Period**: Number of bars for ATR calculation (default: 14)
- **Line Color**: Color of the ATR line (default: teal)
- **Line Width**: Width of the ATR line (default: 2)

**Output**: Single volatility line

**Use Case**: Assess market volatility for stop-loss placement and position sizing

---

### 6. ADX - Average Directional Index (Trend)

**ID**: `adx`  
**Category**: Trend  
**Display**: Separate pane

**Description**: Measures the strength of a trend (not its direction). Values range from 0-100, with readings above 25 indicating a strong trend and below 20 indicating a weak or non-existent trend.

**Settings**:
- **Period**: Number of bars for ADX calculation (default: 14)
- **Line Color**: Color of the ADX line (default: cyan)
- **Line Width**: Width of the ADX line (default: 2)

**Output**: Single trend strength line

**Use Case**: Determine whether the market is trending or ranging

---

### 7. MACD - Moving Average Convergence Divergence (Momentum)

**ID**: `macd`  
**Category**: Momentum  
**Display**: Separate pane

**Description**: Trend-following momentum indicator that shows the relationship between two moving averages. Consists of the MACD line, signal line, and histogram.

**Settings**:
- **Fast Period**: Period for fast EMA (default: 12)
- **Slow Period**: Period for slow EMA (default: 26)
- **Signal Period**: Period for signal line (default: 9)
- **MACD Line Color**: Color of the MACD line (default: blue)
- **Signal Line Color**: Color of the signal line (default: red)
- **Histogram Color**: Color of the histogram (default: green)
- **Line Width**: Width of the MACD and signal lines (default: 2)

**Output**: Three components (MACD line, signal line, histogram)

**Use Case**: Identify trend changes, momentum, and potential entry/exit points

---

## Usage

All indicators can be added through the **"Add Indicator"** button in the chart interface:

1. Click "Add Indicator"
2. Browse by category or search for the indicator name
3. Click "Add" to add the indicator with default settings
4. Click the settings icon (gear) to customize parameters
5. Multiple instances can be added with different settings

## Technical Implementation

All indicators are implemented using the `fast-technical-indicators` library, which provides:
- High performance (1.3x-9.6x faster than alternatives)
- Zero dependencies
- Full TypeScript support
- Drop-in replacement for `technicalindicators` package

### File Structure

```
src/indicators/registry/
├── stochastic.ts    # Stochastic Oscillator
├── obv.ts           # On-Balance Volume
├── mfi.ts           # Money Flow Index
├── forceindex.ts    # Force Index
├── atr.ts           # Average True Range
├── adx.ts           # Average Directional Index
└── macd.ts          # MACD
```

### Example: Adding a Custom Indicator

To add more indicators from the `fast-technical-indicators` library:

1. Create a new file in `src/indicators/registry/`
2. Import the indicator function from `fast-technical-indicators`
3. Define the indicator using the `IndicatorDefinition` structure
4. Register it in `src/indicators/registry/index.ts`

Example structure:
```typescript
import { IndicatorDefinition, IndicatorCategory, ChartSeriesType } from '../core/types';
import { indicatorFunction } from 'fast-technical-indicators';

export const MyIndicator: IndicatorDefinition = {
  metadata: { /* ... */ },
  settings: { /* ... */ },
  renderConfig: { /* ... */ },
  calculate: (bars, settings) => {
    // Use the library function
    const values = indicatorFunction({ /* params */ });
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: values[i] ?? NaN,
    })).filter(point => !isNaN(point.value));
  },
};
```

## Available Indicators from Library

The `fast-technical-indicators` library supports many more indicators that can be easily added:
- ROC (Rate of Change)
- Ichimoku Cloud
- Aroon / Aroon Oscillator
- TRIX
- PPO (Percentage Price Oscillator)
- Stochastic RSI
- Ultimate Oscillator
- DPO (Detrended Price Oscillator)
- KST (Know Sure Thing)
- Donchian Channels
- Heikin Ashi
- And many more...

See the [fast-technical-indicators documentation](https://github.com/santoshkshirsagar/fast-technical-indicators) for a complete list.
