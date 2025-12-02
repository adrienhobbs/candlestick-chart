# Creating Custom Indicators

This guide walks you through creating your own custom indicators for the trading chart.

## Step-by-Step Guide

### Step 1: Define Your Indicator

Create a new file in `src/indicators/registry/` for your indicator. For example, `myindicator.ts`.

### Step 2: Import Required Types

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { OHLCVBar } from '../../types/chart';
```

### Step 3: Define the Indicator Structure

An indicator definition consists of four main parts:

1. **Metadata**: Basic information about the indicator
2. **Settings**: Configuration options with Zod schema
3. **Render Config**: How to display the indicator
4. **Calculate**: The calculation function

### Step 4: Create the Indicator Definition

```typescript
export const MyIndicator: IndicatorDefinition = {
  // 1. Metadata
  metadata: {
    id: 'myindicator',                    // Unique identifier (lowercase, no spaces)
    name: 'My Indicator',                  // Display name
    description: 'Description of what this indicator does',
    category: IndicatorCategory.TREND,     // Category for organization
    version: '1.0.0',                      // Version number
  },

  // 2. Settings Schema
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for calculation',
      min: 1,
      max: 500,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the indicator line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      min: 1,
      max: 5,
      step: 1,
    },
  },

  // 3. Render Configuration
  renderConfig: {
    seriesType: ChartSeriesType.LINE,     // LINE, HISTOGRAM, or AREA
    outputCount: 1,                        // Number of lines (1 for single, 3 for Bollinger, etc.)
  },

  // 4. Calculation Function
  calculate: (bars, settings) => {
    // Your calculation logic here
    const results = [];

    for (let i = 0; i < bars.length; i++) {
      // Calculate indicator value for each bar
      const value = calculateValue(bars, i, settings);

      results.push({
        time: bars[i].timestamp,
        value: value,
      });
    }

    // Filter out invalid values (NaN, null, undefined)
    return results.filter(point => !isNaN(point.value));
  },
};
```

### Step 5: Register the Indicator

Open `src/indicators/registry/index.ts` and:

1. Import your indicator:
```typescript
import { MyIndicator } from './myindicator';
```

2. Register it in the `registerBuiltInIndicators` function:
```typescript
export function registerBuiltInIndicators(): void {
  indicatorRegistry.register(SMAIndicator);
  indicatorRegistry.register(EMAIndicator);
  indicatorRegistry.register(RSIIndicator);
  indicatorRegistry.register(BollingerBandsIndicator);
  indicatorRegistry.register(MyIndicator);  // Add your indicator here
}
```

3. Export it:
```typescript
export { SMAIndicator, EMAIndicator, RSIIndicator, BollingerBandsIndicator, MyIndicator };
```

## Setting Types

The indicator system supports several setting types:

### Number
```typescript
{
  type: 'number',
  label: 'Period',
  defaultValue: 14,
  description: 'Optional description',
  min: 1,        // Optional minimum value
  max: 500,      // Optional maximum value
  step: 1,       // Optional step value
}
```

### Color
```typescript
{
  type: 'color',
  label: 'Line Color',
  defaultValue: '#3b82f6',
  description: 'Optional description',
}
```

### Boolean
```typescript
{
  type: 'boolean',
  label: 'Show Signals',
  defaultValue: true,
  description: 'Optional description',
}
```

### Select (Dropdown)
```typescript
{
  type: 'select',
  label: 'MA Type',
  defaultValue: 'sma',
  options: [
    { label: 'Simple', value: 'sma' },
    { label: 'Exponential', value: 'ema' },
    { label: 'Weighted', value: 'wma' },
  ],
}
```

### Line Style
```typescript
{
  type: 'lineStyle',
  label: 'Line Style',
  defaultValue: 'solid',  // 'solid', 'dashed', or 'dotted'
}
```

## Chart Series Types

### LINE
Single line indicator:
```typescript
renderConfig: {
  seriesType: ChartSeriesType.LINE,
  outputCount: 1,
}
```

### HISTOGRAM
Bar chart indicator:
```typescript
renderConfig: {
  seriesType: ChartSeriesType.HISTOGRAM,
  outputCount: 1,
}
```

### AREA
Filled area indicator:
```typescript
renderConfig: {
  seriesType: ChartSeriesType.AREA,
  outputCount: 1,
}
```

### Multiple Lines
For indicators like Bollinger Bands with multiple lines:
```typescript
renderConfig: {
  seriesType: ChartSeriesType.LINE,
  outputCount: 3,  // Will create 3 separate lines
}

// In calculate function, return data with multiple values:
calculate: (bars, settings) => {
  return bars.map((bar, i) => ({
    time: bar.timestamp,
    value: middleValue,   // Main value
    upper: upperValue,    // Additional line
    lower: lowerValue,    // Additional line
  }));
}
```

## Calculation Function

The calculate function receives:
- `bars`: Array of OHLCV bar data
- `settings`: Object with user-configured settings

And returns an array of indicator outputs:

```typescript
interface IndicatorOutput {
  time: number;          // Bar timestamp
  value: number;         // Main indicator value
  [key: string]: number; // Additional values for multi-line indicators
}
```

### Tips for Calculations

1. **Handle Insufficient Data**: Return NaN for bars where you don't have enough data
```typescript
if (i < settings.period - 1) {
  return NaN;  // Will be filtered out
}
```

2. **Use Helper Functions**: Place common calculations in `src/indicators/utils/calculations.ts`

3. **Optimize Performance**: The results are cached automatically, so focus on correctness

4. **Validate Inputs**: The system validates settings against your schema automatically

## Complete Example: VWAP Indicator

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';

export const VWAPIndicator: IndicatorDefinition = {
  metadata: {
    id: 'vwap',
    name: 'VWAP',
    description: 'Volume Weighted Average Price - average price weighted by volume',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#f59e0b',
      description: 'Color of the VWAP line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      min: 1,
      max: 5,
      step: 1,
    },
    resetDaily: {
      type: 'boolean',
      label: 'Reset Daily',
      defaultValue: true,
      description: 'Reset VWAP at start of each trading day',
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
  },
  calculate: (bars, settings) => {
    const results = [];
    let cumulativePV = 0;  // Price * Volume
    let cumulativeVolume = 0;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;

      // Use VWAP from data if available, otherwise calculate
      if (bar.vwap) {
        results.push({
          time: bar.timestamp,
          value: bar.vwap,
        });
      } else {
        cumulativePV += typicalPrice * bar.volume;
        cumulativeVolume += bar.volume;

        const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : typicalPrice;

        results.push({
          time: bar.timestamp,
          value: vwap,
        });
      }
    }

    return results;
  },
};
```

## Testing Your Indicator

1. **Add it to the chart**: Use the indicator browser to add your new indicator
2. **Test with different settings**: Try various parameter combinations
3. **Verify calculations**: Compare with known good implementations
4. **Test edge cases**: Very small periods, very large periods, missing data
5. **Check performance**: Ensure calculations complete quickly

## Best Practices

1. **Clear naming**: Use descriptive names for your indicator and settings
2. **Good defaults**: Choose sensible default values that work for most users
3. **Add descriptions**: Help users understand what each setting does
4. **Validate early**: Return NaN for invalid calculations rather than throwing errors
5. **Document formulas**: Add comments explaining the calculation methodology
6. **Reuse utilities**: Use existing calculation functions when possible

## Next Steps

- Check out [example indicators](./examples.md) for more implementations
- Read the [architecture documentation](./architecture.md) to understand the system
- Review the [API reference](./api-reference.md) for detailed function signatures
