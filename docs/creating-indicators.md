# Creating Custom Indicators

How to write an indicator and add it to the chart. An indicator is an
`IndicatorDefinition` object that you register with `indicatorRegistry`; once registered
it appears in the `IndicatorBrowser`, gets a generated settings form, and renders on
`ChartComponent` like a built-in. You do not need to change candlekit.

For the built-in indicators and their settings, see [Indicators](./indicators.md).

## Step-by-Step Guide

### Step 1: Import the types

```typescript
import {
  ChartSeriesType,
  IndicatorCategory,
  type IndicatorDefinition,
  type IndicatorOutput,
} from '@adrienhobbs/candlekit';
```

### Step 2: Understand the structure

A definition has four parts:

1. **Metadata**: id, display name, description, category, version
2. **Settings**: the configurable fields, used for defaults and the settings form
3. **Render config**: how the output is drawn
4. **Calculate**: a function from bars and settings to output points

### Step 3: Write the definition

```typescript
export const MomentumIndicator: IndicatorDefinition = {
  // 1. Metadata
  metadata: {
    id: 'momentum',                 // unique; also the prefix of instance ids ('momentum-1')
    name: 'Momentum',               // shown in the browser and as the series title
    description: 'Close minus the close N bars ago',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },

  // 2. Settings
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 10,
      description: 'Bars to look back',
      min: 1,
      max: 500,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#3b82f6',
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

  // 3. Render configuration
  renderConfig: {
    seriesType: ChartSeriesType.LINE,  // LINE, HISTOGRAM, AREA or POINTS
    outputCount: 1,                    // number of output fields drawn
    overlay: false,                    // false = own pane below price; true = on the price pane
    // priceLineVisible: false,        // hide the full-width last-value line, e.g. for a
                                       //   level that resets each day. A single-output LINE
                                       //   also breaks at NaN values, so emit NaN between segments.
  },

  // 4. Calculation
  calculate: (bars, settings): IndicatorOutput[] => {
    const period = Number(settings.period);
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,      // seconds, not milliseconds
      value: i >= period ? bar.close - bars[i - period].close : NaN,
    }));
  },
};
```

`outputCount` and `overlay` have defaults in the Zod schema but are required by the
TypeScript type, so set both. The same holds for `metadata.version`.

### Step 4: Register it

Register once at startup, after the built-ins (if you use them) and before rendering:

```typescript
import { indicatorRegistry, registerBuiltInIndicators } from '@adrienhobbs/candlekit';
import { MomentumIndicator } from './indicators/momentum';

registerBuiltInIndicators();
indicatorRegistry.register(MomentumIndicator);
```

Registering an id that already exists replaces the earlier definition (with a console
warning), which is also how you override a built-in.

### Step 5: Add it to a chart

From the `IndicatorBrowser` (it lists every registered definition), or in code:

```typescript
const { addIndicator } = useChartAPI();
addIndicator('momentum', { period: 20 });
```

Persisted instances store only `definitionId` and settings, so a page that restores them
must register the same definitions first; instances whose definition is missing are not
drawn.

## Setting Types

Each setting is a `SettingField`. Values are stored on the instance's `settings` under the
same key; `calculate` receives them, and `defaultValue` is used when an instance is
created.

### Number
```typescript
{
  type: 'number',
  label: 'Period',
  defaultValue: 14,
  description: 'Optional description',
  min: 1,        // optional
  max: 500,      // optional
  step: 1,       // optional
}
```

### Color
```typescript
{
  type: 'color',
  label: 'Line Color',
  defaultValue: '#3b82f6',
}
```

The form shows a color picker plus an opacity slider; the stored value is a hex string,
or `rgba(r, g, b, a)` when opacity is below 100%.

### Boolean
```typescript
{
  type: 'boolean',
  label: 'Show Signals',
  defaultValue: true,
}
```

### Select (dropdown)
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

Option values are strings.

### Line Style
```typescript
{
  type: 'lineStyle',
  label: 'Line Style',
  defaultValue: 'solid',  // 'solid' | 'dashed' | 'dotted'
}
```

The form offers the choice, but indicator series do not read a `lineStyle` setting when
drawing; use it only if your own code consumes it.

### Settings the renderer reads

The chart picks some settings up by name:

| Setting | Used by |
|---|---|
| `color` | Single-output LINE and HISTOGRAM color; the `value` field of multi-output and POINTS indicators |
| `lineWidth` | All line series |
| `<field>Color` | Color of output field `<field>` in multi-output LINE and POINTS indicators (for example `signalColor`, `histogramColor`, `highColor`) |
| `upperColor`, `middleColor`, `lowerColor` | Band-fill indicators (`vwapColor` is accepted for the middle line) |
| `showFill`, `fillColor` | Band-fill indicators: `showFill: false` hides the fill |
| `topColor`, `bottomColor`, `lineColor` | AREA indicators |
| `pointShape`, `pointPosition`, `pointSize` | POINTS indicators, overriding `renderConfig` |

Any other setting is only passed to `calculate`.

## Chart Series Types

### LINE
```typescript
renderConfig: {
  seriesType: ChartSeriesType.LINE,
  outputCount: 1,
  overlay: true,
}
```

### HISTOGRAM
```typescript
renderConfig: {
  seriesType: ChartSeriesType.HISTOGRAM,
  outputCount: 1,
  overlay: false,
}
```

### AREA
```typescript
renderConfig: {
  seriesType: ChartSeriesType.AREA,
  outputCount: 1,
  overlay: false,
}
```

### POINTS
Dots (or squares / arrows) at individual bars on the price pane: pivots, signals,
anything that is an event at a bar rather than a continuous value.

```typescript
renderConfig: {
  seriesType: ChartSeriesType.POINTS,
  outputCount: 1,
  overlay: true,              // ignored: points always sit on the price pane
  pointShape: 'circle',       // 'circle' | 'square' | 'arrowUp' | 'arrowDown' (default 'circle')
  pointPosition: 'atPrice',   // 'atPrice' | 'aboveBar' | 'belowBar' (default 'atPrice')
  pointSize: 1,               // lightweight-charts marker size units (default 1)
}

calculate: (bars, settings) => bars.map((bar) => ({
  time: bar.timestamp / 1000,
  value: isSignal(bar) ? bar.low : NaN,   // NaN = no point on this bar
}));
```

- A **finite** `value` is a point at that bar and price; **NaN** (or any non-finite
  value) means no point.
- `'atPrice'` centres the marker on the value. `'aboveBar'` / `'belowBar'` put it
  just off the candle and ignore the value's price (the value still decides
  whether the bar gets a point).
- Colour comes from the instance's `color` setting, as for LINE.
- `pointShape`, `pointPosition` and `pointSize` can also be **instance settings** of
  the same name (e.g. a `select` setting for the shape), which override the
  `renderConfig` values when valid.
- **Several point sets** from one indicator: list the fields in `pointFields`. Each
  field gets its own colour from a `<field>Color` setting, else a palette slot.
  `value` is still required by `IndicatorOutput`; set it to `NaN` if you don't draw it.

```typescript
renderConfig: {
  seriesType: ChartSeriesType.POINTS,
  outputCount: 2,
  overlay: true,
  pointFields: ['high', 'low'],   // colours: settings.highColor, settings.lowColor
}
```

Points are drawn as lightweight-charts series markers on the candlestick series,
through their own markers plugin per field (`createSeriesMarkers`), so they never
replace the chart's trade or `markers`-prop markers. They have no series, so they
don't appear in the OHLC legend's indicator values. Text labels are not supported.

The built-in **Swing Points** (`swingpoints`) is a complete example: dots at swing
highs and lows. It is a lagging marker. A pivot at bar `i` is only confirmed
`strength` bars later. With `plotAt: 'pivot'` (the default) the point is drawn at bar
`i`, so the newest `strength` bars never carry one; `plotAt: 'confirmation'` draws it on
bar `i + strength` (still at bar `i`'s price) instead.

### Multiple Outputs

A `calculate` that returns extra fields per point renders as multiple series.
There are two flavours:

**Band fill** (Bollinger, Keltner, Donchian) — an upper/middle/lower band with a
shaded fill between the bounds. Set `hasBandFill` + `fillBands`:

```typescript
renderConfig: {
  seriesType: ChartSeriesType.LINE,
  outputCount: 3,
  overlay: true,
  hasBandFill: true,
  fillBands: { upper: 'upper', lower: 'lower' },  // field names on each point
}

calculate: (bars, settings) => bars.map((bar, i) => ({
  time: bar.timestamp / 1000,
  value: middleValue,   // the middle line
  upper: upperValue,
  lower: lowerValue,
}));
```

**Generic multi-output** (MACD, Stochastic, StochRSI, …) — `outputCount > 1` with
**no** band fill. Each output field becomes its own series: a field literally named
`histogram` renders as a histogram, every other field as a line. Per-field color
comes from a `<field>Color` setting (the primary `value` uses `color`), else a
palette. Pair with `overlay: false` to draw it in a separate pane below price.

```typescript
renderConfig: {
  seriesType: ChartSeriesType.LINE,
  outputCount: 3,
  overlay: false,        // separate pane
}

calculate: (bars, settings) => bars.map((bar, i) => ({
  time: bar.timestamp / 1000,
  value: macdValue,      // line  (uses settings.color)
  signal: signalValue,   // line  (uses settings.signalColor)
  histogram: histValue,  // histogram (uses settings.histogramColor)
}));
```

The series are created from the fields of the first output point, so every point must
carry the same fields.

> Warm-up bars should emit `NaN` for a field; non-finite values are dropped before
> rendering (a single-output LINE turns them into gaps instead).

## Calculation Function

`calculate(bars, settings)` receives:
- `bars`: the `OHLCVBar[]` passed to the chart (timestamps in epoch milliseconds)
- `settings`: the instance's settings object

and returns one output per bar:

```typescript
interface IndicatorOutput {
  time: number;          // bar.timestamp / 1000 (UNIX seconds, as lightweight-charts expects)
  value: number;         // main value
  [key: string]: number; // extra fields for multi-output indicators
}
```

### Tips

1. **Return one point per bar**, with `NaN` where there is not enough data. Do not filter
   the warm-up out yourself; the renderer drops or gaps non-finite values, and keeping
   one point per bar keeps every field aligned.
2. **Use seconds for `time`.** A millisecond `time` does not line up with the candles.
3. **Coerce settings** you rely on (`Number(settings.period)`): persisted settings come
   back from JSON, and nothing validates them before `calculate` runs.
4. **Results are cached** per instance, keyed on the settings and a bars fingerprint, so
   `calculate` must be a pure function of its arguments.
5. **Errors are caught.** If `calculate` throws, the calculator logs it and the indicator
   draws nothing.
6. **Reuse the exported helpers**: `calculateSMA`, `calculateEMA`, `calculateRSI`,
   `calculateBollingerBands`, `calculateStandardDeviation`, `padIndicatorArray` (left-pad
   a shorter result from a TA library with `NaN`), `displaceArray`.

## Complete Example: Cumulative VWAP

A simplified VWAP that resets each day (the built-in `vwap` adds bands and other reset
periods):

```typescript
import { ChartSeriesType, IndicatorCategory, type IndicatorDefinition } from '@adrienhobbs/candlekit';

export const DailyVWAPIndicator: IndicatorDefinition = {
  metadata: {
    id: 'daily-vwap',
    name: 'Daily VWAP',
    description: 'Volume-weighted average price, reset at the start of each day',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    color: { type: 'color', label: 'Line Color', defaultValue: '#f59e0b' },
    lineWidth: { type: 'number', label: 'Line Width', defaultValue: 2, min: 1, max: 5, step: 1 },
    resetDaily: {
      type: 'boolean',
      label: 'Reset Daily',
      defaultValue: true,
      description: 'Restart the average on each new calendar day (viewer time zone)',
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
    priceLineVisible: false,
  },
  calculate: (bars, settings) => {
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    let day = '';

    return bars.map((bar) => {
      const barDay = new Date(bar.timestamp).toDateString();
      if (settings.resetDaily && barDay !== day) {
        cumulativePV = 0;
        cumulativeVolume = 0;
      }
      day = barDay;

      const typical = (bar.high + bar.low + bar.close) / 3;
      cumulativePV += typical * bar.volume;
      cumulativeVolume += bar.volume;

      return {
        time: bar.timestamp / 1000,
        value: cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : typical,
      };
    });
  },
};
```

## Contributing a Built-in Indicator

To add an indicator to candlekit itself (rather than to your app), work in the candlekit
repository:

1. Add `src/indicators/registry/<name>.ts` exporting the definition. Inside the repo,
   import from the source modules and use the setting builders, which are internal (not
   exported from the package):

   ```typescript
   import { IndicatorDefinition, IndicatorCategory, ChartSeriesType } from '../core/types';
   import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
   ```

2. In `src/indicators/registry/index.ts`, import it, add
   `indicatorRegistry.register(MyIndicator)` to `registerBuiltInIndicators`, and add it to
   the export list.
3. Add its default settings to `src/indicators/core/registry.defaults.test.ts` and a test
   for the calculation, then run `npm test`.
4. Document it in [Indicators](./indicators.md).

`fast-technical-indicators` is available as a devDependency for built-ins; it is bundled
into the published package, so consumers do not install it.

## Testing Your Indicator

1. **Unit-test `calculate`** with a few hand-built bars and known values (see the
   [examples](./examples.md#testing-examples)).
2. **Add it to a chart** from the indicator browser and change each setting.
3. **Compare** with a reference implementation for a few bars.
4. **Try edge cases**: fewer bars than the period, very large periods, flat prices, zero
   volume.

## Best Practices

1. **Clear names** for the indicator and its settings; `label` is what users see.
2. **Sensible defaults**: they are used for every new instance.
3. **Descriptions** on settings appear under each field in the form.
4. **Return NaN rather than throwing** for bars you cannot compute.
5. **Follow the renderer's setting names** (`color`, `lineWidth`, `<field>Color`) so colors
   are editable without extra code.

## Next Steps

- [Examples](./examples.md): more complete definitions
- [Architecture](./architecture.md): how definitions are calculated and rendered
- [API Reference](./api-reference.md): registry, calculator and type signatures
