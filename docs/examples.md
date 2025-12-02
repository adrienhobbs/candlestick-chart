# Indicator Examples

This document provides complete examples of various indicator implementations.

## Example 1: Simple Moving Average (SMA)

A basic indicator with period, color, and line width settings.

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { calculateSMA } from '../utils/calculations';

export const SMAIndicator: IndicatorDefinition = {
  metadata: {
    id: 'sma',
    name: 'SMA',
    description: 'Simple Moving Average - smooths price data by averaging over a period',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars to average',
      min: 1,
      max: 500,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the SMA line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the SMA line',
      min: 1,
      max: 5,
      step: 1,
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
  },
  calculate: (bars, settings) => {
    const smaValues = calculateSMA(bars, settings.period);
    return bars
      .map((bar, i) => ({
        time: bar.timestamp,
        value: smaValues[i],
      }))
      .filter((point) => !isNaN(point.value));
  },
};
```

## Example 2: RSI with Histogram Display

An oscillator indicator using histogram rendering.

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { calculateRSI } from '../utils/calculations';

export const RSIIndicator: IndicatorDefinition = {
  metadata: {
    id: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index - momentum oscillator',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      min: 2,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#8b5cf6',
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
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
  },
  calculate: (bars, settings) => {
    const rsiValues = calculateRSI(bars, settings.period);
    return bars
      .map((bar, i) => ({
        time: bar.timestamp,
        value: rsiValues[i],
      }))
      .filter((point) => !isNaN(point.value));
  },
};
```

## Example 3: Bollinger Bands (Multi-Line)

An indicator with multiple output lines.

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { calculateBollingerBands } from '../utils/calculations';

export const BollingerBandsIndicator: IndicatorDefinition = {
  metadata: {
    id: 'bollinger',
    name: 'Bollinger Bands',
    description: 'Volatility bands placed above and below a moving average',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      min: 2,
      max: 200,
      step: 1,
    },
    stdDev: {
      type: 'number',
      label: 'Standard Deviation',
      defaultValue: 2,
      min: 0.5,
      max: 5,
      step: 0.1,
    },
    upperColor: {
      type: 'color',
      label: 'Upper Band Color',
      defaultValue: '#ef4444',
    },
    middleColor: {
      type: 'color',
      label: 'Middle Band Color',
      defaultValue: '#3b82f6',
    },
    lowerColor: {
      type: 'color',
      label: 'Lower Band Color',
      defaultValue: '#10b981',
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
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 3,  // Three separate lines
  },
  calculate: (bars, settings) => {
    const { upper, middle, lower } = calculateBollingerBands(
      bars,
      settings.period,
      settings.stdDev
    );

    return bars
      .map((bar, i) => ({
        time: bar.timestamp,
        value: middle[i],  // Middle band as main value
        upper: upper[i],   // Upper band
        lower: lower[i],   // Lower band
      }))
      .filter((point) => !isNaN(point.value));
  },
};
```

## Example 4: MACD with Boolean Setting

An indicator using boolean and select settings.

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { calculateEMA } from '../utils/calculations';

export const MACDIndicator: IndicatorDefinition = {
  metadata: {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    fastPeriod: {
      type: 'number',
      label: 'Fast Period',
      defaultValue: 12,
      min: 2,
      max: 100,
      step: 1,
    },
    slowPeriod: {
      type: 'number',
      label: 'Slow Period',
      defaultValue: 26,
      min: 2,
      max: 100,
      step: 1,
    },
    signalPeriod: {
      type: 'number',
      label: 'Signal Period',
      defaultValue: 9,
      min: 2,
      max: 50,
      step: 1,
    },
    showHistogram: {
      type: 'boolean',
      label: 'Show Histogram',
      defaultValue: true,
      description: 'Display MACD histogram',
    },
    macdColor: {
      type: 'color',
      label: 'MACD Line Color',
      defaultValue: '#3b82f6',
    },
    signalColor: {
      type: 'color',
      label: 'Signal Line Color',
      defaultValue: '#ef4444',
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
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 2,
  },
  calculate: (bars, settings) => {
    const fastEMA = calculateEMA(bars, settings.fastPeriod);
    const slowEMA = calculateEMA(bars, settings.slowPeriod);

    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);

    const macdBars = bars.map((bar, i) => ({
      ...bar,
      close: macdLine[i],
    }));

    const signalLine = calculateEMA(macdBars, settings.signalPeriod);

    return bars
      .map((bar, i) => ({
        time: bar.timestamp,
        value: macdLine[i],
        signal: signalLine[i],
      }))
      .filter((point) => !isNaN(point.value));
  },
};
```

## Example 5: ATR (Average True Range)

An indicator using custom calculation logic.

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';

export const ATRIndicator: IndicatorDefinition = {
  metadata: {
    id: 'atr',
    name: 'ATR',
    description: 'Average True Range - measures market volatility',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      min: 1,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#14b8a6',
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
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
  },
  calculate: (bars, settings) => {
    const trueRanges: number[] = [];

    for (let i = 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    const atrValues: number[] = [NaN];

    for (let i = 0; i < trueRanges.length; i++) {
      if (i < settings.period - 1) {
        atrValues.push(NaN);
      } else if (i === settings.period - 1) {
        let sum = 0;
        for (let j = 0; j < settings.period; j++) {
          sum += trueRanges[i - j];
        }
        atrValues.push(sum / settings.period);
      } else {
        const prevATR = atrValues[atrValues.length - 1];
        const currentTR = trueRanges[i];
        const atr = (prevATR * (settings.period - 1) + currentTR) / settings.period;
        atrValues.push(atr);
      }
    }

    return bars
      .map((bar, i) => ({
        time: bar.timestamp,
        value: atrValues[i],
      }))
      .filter((point) => !isNaN(point.value));
  },
};
```

## Example 6: Volume Profile

A histogram indicator based on volume data.

```typescript
import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';

export const VolumeProfileIndicator: IndicatorDefinition = {
  metadata: {
    id: 'volume_profile',
    name: 'Volume Profile',
    description: 'Displays volume distribution at price levels',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    color: {
      type: 'color',
      label: 'Volume Color',
      defaultValue: '#8b5cf6',
    },
    opacity: {
      type: 'number',
      label: 'Opacity',
      defaultValue: 70,
      min: 0,
      max: 100,
      step: 5,
      description: 'Transparency of volume bars (0-100)',
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.HISTOGRAM,
    outputCount: 1,
  },
  calculate: (bars, settings) => {
    return bars.map((bar) => ({
      time: bar.timestamp,
      value: bar.volume,
    }));
  },
};
```

## Usage Examples

### Registering Multiple Indicators

```typescript
import { indicatorRegistry } from './indicators/core/registry';
import { SMAIndicator } from './indicators/registry/sma';
import { EMAIndicator } from './indicators/registry/ema';
import { RSIIndicator } from './indicators/registry/rsi';
import { MACDIndicator } from './indicators/registry/macd';
import { ATRIndicator } from './indicators/registry/atr';

export function registerAllIndicators() {
  indicatorRegistry.register(SMAIndicator);
  indicatorRegistry.register(EMAIndicator);
  indicatorRegistry.register(RSIIndicator);
  indicatorRegistry.register(MACDIndicator);
  indicatorRegistry.register(ATRIndicator);
}
```

### Creating Instances Programmatically

```typescript
import { indicatorRegistry } from './indicators';

// Create with default settings
const sma20 = indicatorRegistry.createInstance('sma');

// Create with custom settings
const sma50 = indicatorRegistry.createInstance('sma', {
  period: 50,
  color: '#10b981',
});

// Create multiple instances
const ema12 = indicatorRegistry.createInstance('ema', { period: 12 });
const ema26 = indicatorRegistry.createInstance('ema', { period: 26 });
```

### Using in Components

```typescript
import React from 'react';
import { useChartAPI } from './hooks/useChartAPI';

function TradingSetup() {
  const { addIndicator } = useChartAPI();

  const setupTrendFollowing = () => {
    // Add multiple indicators for trend following
    addIndicator('sma', { period: 20, color: '#3b82f6' });
    addIndicator('sma', { period: 50, color: '#10b981' });
    addIndicator('sma', { period: 200, color: '#ef4444' });
    addIndicator('ema', { period: 12, color: '#8b5cf6' });
  };

  const setupMomentum = () => {
    // Add momentum indicators
    addIndicator('rsi', { period: 14 });
    addIndicator('macd', {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
  };

  return (
    <div>
      <button onClick={setupTrendFollowing}>
        Setup Trend Following
      </button>
      <button onClick={setupMomentum}>
        Setup Momentum Analysis
      </button>
    </div>
  );
}
```

## Testing Examples

### Unit Test for Indicator Calculation

```typescript
import { SMAIndicator } from './sma';
import { OHLCVBar } from '../../types/chart';

describe('SMA Indicator', () => {
  const mockBars: OHLCVBar[] = [
    { timestamp: 1000, open: 10, high: 11, low: 9, close: 10, volume: 1000 },
    { timestamp: 2000, open: 10, high: 12, low: 10, close: 11, volume: 1100 },
    { timestamp: 3000, open: 11, high: 12, low: 10, close: 12, volume: 1200 },
    { timestamp: 4000, open: 12, high: 13, low: 11, close: 13, volume: 1300 },
    { timestamp: 5000, open: 13, high: 14, low: 12, close: 14, volume: 1400 },
  ];

  it('calculates SMA correctly', () => {
    const result = SMAIndicator.calculate(mockBars, { period: 3 });

    expect(result).toHaveLength(3);
    expect(result[0].value).toBeCloseTo(11, 2);  // (10+11+12)/3
    expect(result[1].value).toBeCloseTo(12, 2);  // (11+12+13)/3
    expect(result[2].value).toBeCloseTo(13, 2);  // (12+13+14)/3
  });

  it('filters out NaN values', () => {
    const result = SMAIndicator.calculate(mockBars, { period: 10 });

    expect(result).toHaveLength(0);  // Not enough data
    expect(result.every(r => !isNaN(r.value))).toBe(true);
  });
});
```

## Advanced Patterns

### Composite Indicator

Create an indicator that combines multiple calculations:

```typescript
export const SuperTrendIndicator: IndicatorDefinition = {
  // ... metadata and settings

  calculate: (bars, settings) => {
    // Calculate ATR
    const atr = calculateATR(bars, settings.atrPeriod);

    // Calculate SuperTrend
    const results = [];
    let trend = 1;  // 1 for up, -1 for down

    for (let i = 0; i < bars.length; i++) {
      const hl2 = (bars[i].high + bars[i].low) / 2;
      const upperBand = hl2 + settings.multiplier * atr[i];
      const lowerBand = hl2 - settings.multiplier * atr[i];

      // Trend logic...
      const value = trend === 1 ? lowerBand : upperBand;

      results.push({
        time: bars[i].timestamp,
        value: value,
        trend: trend,
      });
    }

    return results.filter(r => !isNaN(r.value));
  },
};
```

These examples demonstrate various patterns and techniques for creating indicators. Use them as templates for your own custom indicators.
