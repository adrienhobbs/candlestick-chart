# Indicator Examples

Complete indicator definitions written from a consumer's point of view: each one imports
from `@adrienhobbs/candlekit`, and is added to the chart with
`indicatorRegistry.register(...)`. See [Creating Indicators](./creating-indicators.md)
for the rules behind them, and [Indicators](./indicators.md) for the built-ins (several
examples below re-create a built-in in simplified form; give yours a different `id`, or
registering it replaces the built-in).

Every `calculate` returns one point per bar, with `time` in seconds and `NaN` during
warm-up; the renderer drops or gaps the `NaN` points.

## Example 1: Simple Moving Average (SMA)

A single line on the price pane.

```typescript
import {
  calculateSMA,
  ChartSeriesType,
  IndicatorCategory,
  type IndicatorDefinition,
} from '@adrienhobbs/candlekit';

export const MySMAIndicator: IndicatorDefinition = {
  metadata: {
    id: 'my-sma',
    name: 'My SMA',
    description: 'Simple Moving Average of closes',
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
    color: { type: 'color', label: 'Line Color', defaultValue: '#3b82f6' },
    lineWidth: { type: 'number', label: 'Line Width', defaultValue: 2, min: 1, max: 5, step: 1 },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
  },
  calculate: (bars, settings) => {
    const sma = calculateSMA(bars, Number(settings.period));
    return bars.map((bar, i) => ({ time: bar.timestamp / 1000, value: sma[i] }));
  },
};
```

## Example 2: RSI in its own pane

An oscillator drawn below the price chart (`overlay: false`).

```typescript
import {
  calculateRSI,
  ChartSeriesType,
  IndicatorCategory,
  type IndicatorDefinition,
} from '@adrienhobbs/candlekit';

export const MyRSIIndicator: IndicatorDefinition = {
  metadata: {
    id: 'my-rsi',
    name: 'My RSI',
    description: "Wilder's Relative Strength Index",
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    period: { type: 'number', label: 'Period', defaultValue: 14, min: 2, max: 100, step: 1 },
    color: { type: 'color', label: 'Line Color', defaultValue: '#8b5cf6' },
    lineWidth: { type: 'number', label: 'Line Width', defaultValue: 2, min: 1, max: 5, step: 1 },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const rsi = calculateRSI(bars, Number(settings.period));
    return bars.map((bar, i) => ({ time: bar.timestamp / 1000, value: rsi[i] }));
  },
};
```

## Example 3: Bollinger Bands (band fill)

Three lines with a shaded fill between the outer bands. The renderer reads
`upperColor`/`middleColor`/`lowerColor`, `showFill` and `fillColor` by name.

```typescript
import {
  calculateBollingerBands,
  ChartSeriesType,
  IndicatorCategory,
  type IndicatorDefinition,
} from '@adrienhobbs/candlekit';

export const MyBollingerIndicator: IndicatorDefinition = {
  metadata: {
    id: 'my-bollinger',
    name: 'My Bollinger Bands',
    description: 'Standard deviation bands around a moving average',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: { type: 'number', label: 'Period', defaultValue: 20, min: 2, max: 200, step: 1 },
    stdDev: { type: 'number', label: 'Standard Deviation', defaultValue: 2, min: 0.5, max: 5, step: 0.1 },
    upperColor: { type: 'color', label: 'Upper Band Color', defaultValue: '#ef4444' },
    middleColor: { type: 'color', label: 'Middle Band Color', defaultValue: '#3b82f6' },
    lowerColor: { type: 'color', label: 'Lower Band Color', defaultValue: '#10b981' },
    lineWidth: { type: 'number', label: 'Line Width', defaultValue: 2, min: 1, max: 5, step: 1 },
    showFill: { type: 'boolean', label: 'Show Fill', defaultValue: true },
    fillColor: { type: 'color', label: 'Fill Color', defaultValue: 'rgba(59, 130, 246, 0.1)' },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 3,
    overlay: true,
    hasBandFill: true,
    fillBands: { upper: 'upper', lower: 'lower' },
  },
  calculate: (bars, settings) => {
    const { upper, middle, lower } = calculateBollingerBands(
      bars,
      Number(settings.period),
      Number(settings.stdDev),
    );
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: middle[i],
      upper: upper[i],
      lower: lower[i],
    }));
  },
};
```

## Example 4: MACD (lines plus a histogram)

A generic multi-output indicator: each output field becomes its own series in one pane,
and the field named `histogram` is drawn as a histogram. Colors come from `color` (for
`value`) and `<field>Color` settings.

```typescript
import {
  calculateEMA,
  ChartSeriesType,
  IndicatorCategory,
  type IndicatorDefinition,
  type OHLCVBar,
} from '@adrienhobbs/candlekit';

// EMA over an arbitrary series, skipping its leading NaNs (calculateEMA works on closes).
function emaOfSeries(values: number[], period: number): number[] {
  const start = values.findIndex((v) => Number.isFinite(v));
  if (start < 0) return values.map(() => NaN);
  const asBars = values.slice(start).map((close) => ({ close }) as OHLCVBar);
  return [...Array(start).fill(NaN), ...calculateEMA(asBars, period)];
}

export const MyMACDIndicator: IndicatorDefinition = {
  metadata: {
    id: 'my-macd',
    name: 'My MACD',
    description: 'Moving Average Convergence Divergence',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    fastPeriod: { type: 'number', label: 'Fast Period', defaultValue: 12, min: 2, max: 100, step: 1 },
    slowPeriod: { type: 'number', label: 'Slow Period', defaultValue: 26, min: 2, max: 100, step: 1 },
    signalPeriod: { type: 'number', label: 'Signal Period', defaultValue: 9, min: 1, max: 50, step: 1 },
    color: { type: 'color', label: 'MACD Line Color', defaultValue: '#3b82f6' },
    signalColor: { type: 'color', label: 'Signal Line Color', defaultValue: '#ef4444' },
    histogramColor: { type: 'color', label: 'Histogram Color', defaultValue: '#10b981' },
    lineWidth: { type: 'number', label: 'Line Width', defaultValue: 2, min: 1, max: 5, step: 1 },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 3,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const fast = calculateEMA(bars, Number(settings.fastPeriod));
    const slow = calculateEMA(bars, Number(settings.slowPeriod));
    const macd = fast.map((f, i) => f - slow[i]);
    const signal = emaOfSeries(macd, Number(settings.signalPeriod));

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: macd[i],
      signal: signal[i],
      histogram: macd[i] - signal[i],
    }));
  },
};
```

## Example 5: ATR (custom calculation)

Wilder's Average True Range, computed by hand.

```typescript
import { ChartSeriesType, IndicatorCategory, type IndicatorDefinition } from '@adrienhobbs/candlekit';

export const MyATRIndicator: IndicatorDefinition = {
  metadata: {
    id: 'my-atr',
    name: 'My ATR',
    description: 'Average True Range: average bar range including gaps',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: { type: 'number', label: 'Period', defaultValue: 14, min: 1, max: 100, step: 1 },
    color: { type: 'color', label: 'Line Color', defaultValue: '#14b8a6' },
    lineWidth: { type: 'number', label: 'Line Width', defaultValue: 2, min: 1, max: 5, step: 1 },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const period = Number(settings.period);
    const atr: number[] = new Array(bars.length).fill(NaN);

    // trueRange[i] is defined from bar 1 on (it needs the previous close).
    const trueRange = bars.map((bar, i) =>
      i === 0
        ? NaN
        : Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - bars[i - 1].close),
            Math.abs(bar.low - bars[i - 1].close),
          ),
    );

    if (bars.length > period) {
      let sum = 0;
      for (let i = 1; i <= period; i++) sum += trueRange[i];
      atr[period] = sum / period;
      for (let i = period + 1; i < bars.length; i++) {
        atr[i] = (atr[i - 1] * (period - 1) + trueRange[i]) / period;
      }
    }

    return bars.map((bar, i) => ({ time: bar.timestamp / 1000, value: atr[i] }));
  },
};
```

## Example 6: Volume histogram

A HISTOGRAM in its own pane. The chart already draws volume under the candles; this is
the shape to use for any per-bar quantity, here relative volume (volume divided by its
moving average).

```typescript
import { ChartSeriesType, IndicatorCategory, type IndicatorDefinition } from '@adrienhobbs/candlekit';

export const RelativeVolumeIndicator: IndicatorDefinition = {
  metadata: {
    id: 'relative-volume',
    name: 'Relative Volume',
    description: 'Volume divided by its average over the last N bars',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    period: { type: 'number', label: 'Period', defaultValue: 20, min: 2, max: 200, step: 1 },
    color: { type: 'color', label: 'Bar Color', defaultValue: '#8b5cf6' },
  },
  renderConfig: {
    seriesType: ChartSeriesType.HISTOGRAM,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const period = Number(settings.period);
    let windowSum = 0;
    return bars.map((bar, i) => {
      windowSum += bar.volume;
      if (i >= period) windowSum -= bars[i - period].volume;
      const average = windowSum / period;
      return {
        time: bar.timestamp / 1000,
        value: i >= period - 1 && average > 0 ? bar.volume / average : NaN,
      };
    });
  },
};
```

## Example 7: EMA crossover points

A POINTS indicator: arrows at the bars where a fast EMA crosses a slow one, with a
separate output field (and color) for each direction.

```typescript
import {
  calculateEMA,
  ChartSeriesType,
  IndicatorCategory,
  type IndicatorDefinition,
} from '@adrienhobbs/candlekit';

export const EMACrossIndicator: IndicatorDefinition = {
  metadata: {
    id: 'ema-cross',
    name: 'EMA Cross',
    description: 'Marks bars where the fast EMA crosses the slow EMA',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    fastPeriod: { type: 'number', label: 'Fast Period', defaultValue: 9, min: 1, max: 200, step: 1 },
    slowPeriod: { type: 'number', label: 'Slow Period', defaultValue: 21, min: 2, max: 400, step: 1 },
    upColor: { type: 'color', label: 'Cross Up Color', defaultValue: '#10b981' },
    downColor: { type: 'color', label: 'Cross Down Color', defaultValue: '#ef4444' },
    pointSize: { type: 'number', label: 'Point Size', defaultValue: 1, min: 0.5, max: 4, step: 0.5 },
  },
  renderConfig: {
    seriesType: ChartSeriesType.POINTS,
    outputCount: 2,
    overlay: true,
    pointShape: 'circle',
    pointPosition: 'atPrice',
    pointFields: ['up', 'down'],   // colors: settings.upColor, settings.downColor
  },
  calculate: (bars, settings) => {
    const fast = calculateEMA(bars, Number(settings.fastPeriod));
    const slow = calculateEMA(bars, Number(settings.slowPeriod));

    return bars.map((bar, i) => {
      const prev = i > 0 ? fast[i - 1] - slow[i - 1] : NaN;
      const curr = fast[i] - slow[i];
      return {
        time: bar.timestamp / 1000,
        value: NaN,                                   // not drawn (not in pointFields)
        up: prev <= 0 && curr > 0 ? bar.low : NaN,    // NaN = no point
        down: prev >= 0 && curr < 0 ? bar.high : NaN,
      };
    });
  },
};
```

The shape is shared by both fields. To show arrows instead of circles, set
`pointShape` (and `pointPosition: 'belowBar'` or `'aboveBar'`); for different shapes per
direction, split it into two indicators.

## Usage Examples

### Registering indicators

```typescript
import { indicatorRegistry, registerBuiltInIndicators } from '@adrienhobbs/candlekit';
import { EMACrossIndicator, MyATRIndicator, RelativeVolumeIndicator } from './my-indicators';

// Once, at startup, before any chart renders.
registerBuiltInIndicators();
[EMACrossIndicator, MyATRIndicator, RelativeVolumeIndicator].forEach((d) => indicatorRegistry.register(d));
```

To offer only some built-ins, skip `registerBuiltInIndicators()` and register the
exported definitions you want (`SMAIndicator`, `EMAIndicator`, `RSIIndicator`, …).

### Creating instances programmatically

```typescript
import { indicatorRegistry } from '@adrienhobbs/candlekit';

const sma20 = indicatorRegistry.createInstance('sma');                     // defaults
const sma50 = indicatorRegistry.createInstance('sma', { period: 50, color: '#10b981' });
const ema12 = indicatorRegistry.createInstance('ema', { period: 12 });
```

`createInstance` only builds the object; to show it, put it in the `indicators` array you
pass to `ChartComponent`. With `useChartAPI`, `addIndicator` does both.

### Presets in a component

```tsx
import { ChartComponent, useChartAPI, type OHLCVBar } from '@adrienhobbs/candlekit';

function TradingSetup({ bars }: { bars: OHLCVBar[] }) {
  const { indicators, addIndicator } = useChartAPI();

  const setupTrendFollowing = () => {
    addIndicator('sma', { period: 20, color: '#3b82f6' });
    addIndicator('sma', { period: 50, color: '#10b981' });
    addIndicator('sma', { period: 200, color: '#ef4444' });
    addIndicator('ema', { period: 12, color: '#8b5cf6' });
  };

  const setupMomentum = () => {
    addIndicator('rsi', { period: 14 });
    addIndicator('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  };

  return (
    <div>
      <button onClick={setupTrendFollowing}>Trend following</button>
      <button onClick={setupMomentum}>Momentum</button>
      <div style={{ height: 600 }}>
        <ChartComponent bars={bars} indicators={indicators} />
      </div>
    </div>
  );
}
```

## Testing Examples

### Unit test for a calculation (Vitest)

```typescript
import { describe, expect, it } from 'vitest';
import type { OHLCVBar } from '@adrienhobbs/candlekit';
import { MySMAIndicator } from './my-sma';

const closes = [10, 11, 12, 13, 14];
const bars: OHLCVBar[] = closes.map((close, i) => ({
  timestamp: Date.UTC(2025, 0, 2, 14, 30 + i * 5),
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 1000,
}));

describe('MySMAIndicator', () => {
  it('returns one point per bar, NaN during warm-up', () => {
    const result = MySMAIndicator.calculate(bars, { period: 3 });

    expect(result).toHaveLength(5);
    expect(result.slice(0, 2).every((p) => Number.isNaN(p.value))).toBe(true);
    expect(result[2].value).toBeCloseTo(11); // (10 + 11 + 12) / 3
    expect(result[4].value).toBeCloseTo(13); // (12 + 13 + 14) / 3
  });

  it('uses seconds for time', () => {
    const result = MySMAIndicator.calculate(bars, { period: 3 });
    expect(result[0].time).toBe(bars[0].timestamp / 1000);
  });

  it('is all NaN with fewer bars than the period', () => {
    const result = MySMAIndicator.calculate(bars, { period: 10 });
    expect(result.every((p) => Number.isNaN(p.value))).toBe(true);
  });
});
```

The package loads under Node, so tests like this run without a browser environment.
