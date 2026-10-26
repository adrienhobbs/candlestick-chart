# API Reference

Reference for the public API of `@adrienhobbs/candlekit` (0.8.0). Everything below is a
named export of the package root unless stated otherwise.

```bash
npm install @adrienhobbs/candlekit lightweight-charts react react-dom
```

```typescript
import { ChartComponent, useChartAPI, registerBuiltInIndicators } from '@adrienhobbs/candlekit';
import '@adrienhobbs/candlekit/styles.css';
```

Peer dependencies: `lightweight-charts` ^5.1.0, `react` and `react-dom` >= 18. The
indicator math library (`fast-technical-indicators`) is bundled into the package, so you
do not install it, and the package loads under Node (SSR, unit tests).
`styles.css` styles the bundled modals (indicator browser, settings dialogs, context
menu); the chart canvas itself needs no CSS.

For `ChartComponent` props (lines, trades, markers, overlays, sessions, legend), see
[ChartComponent Usage](./chart-component.md). For the built-in indicators and their
settings, see [Indicators](./indicators.md).

## Core API

### IndicatorRegistry

Singleton instance: `indicatorRegistry`. It starts empty; call
`registerBuiltInIndicators()` once (at module load, before rendering) to register the 23
built-ins, then `register` your own definitions.

#### Methods

##### `register(definition: IndicatorDefinition): void`
Registers an indicator definition under `definition.metadata.id`. Registering an id that
already exists overwrites it and logs a warning.

```typescript
import { indicatorRegistry, registerBuiltInIndicators } from '@adrienhobbs/candlekit';

registerBuiltInIndicators();
indicatorRegistry.register(MyCustomIndicator);
```

##### `unregister(id: string): boolean`
Removes a definition. Returns `true` if one was removed.

##### `get(id: string): IndicatorDefinition | undefined`
Retrieves an indicator definition by ID.

```typescript
const definition = indicatorRegistry.get('sma');
```

##### `getAll(): IndicatorDefinition[]`
Returns all registered definitions, in registration order.

##### `getByCategory(category: IndicatorCategory): IndicatorDefinition[]`
Returns all definitions in a category.

```typescript
import { indicatorRegistry, IndicatorCategory } from '@adrienhobbs/candlekit';

const trendIndicators = indicatorRegistry.getByCategory(IndicatorCategory.TREND);
```

##### `search(query: string): IndicatorDefinition[]`
Case-insensitive substring match on name or description.

```typescript
const results = indicatorRegistry.search('moving average');
```

##### `getMetadataList(): IndicatorMetadata[]`
Returns the `metadata` of every registered definition.

##### `createInstance(definitionId: string, customSettings?: Record<string, any>): IndicatorInstance`
Creates an instance with every setting's `defaultValue`, overlaid with `customSettings`.
The ID and name come from a per-definition counter. Throws if the definition is not
registered.

```typescript
const instance = indicatorRegistry.createInstance('sma', { period: 50 });
// instance.id   === 'sma-1'
// instance.name === 'SMA(1)'
```

The counter lives in memory, so after a reload it restarts at 1. Instances restored from
persistence keep their saved IDs; a new instance can get an ID already used by a restored
one.

##### `validateSettings(definitionId: string, settings: Record<string, any>): boolean`
Checks that every declared setting is present and of the right type (`number` within
`min`/`max`, `boolean`, `color`/`lineStyle` as strings, `select` within `options`).
Returns `false` for an unknown definition. Nothing calls it automatically; call it
yourself before saving settings from an untrusted source.

```typescript
const isValid = indicatorRegistry.validateSettings('sma', {
  period: 20,
  color: '#3b82f6',
  lineWidth: 2,
});
```

##### `clear(): void`
Removes every definition and resets the instance counters (useful in tests).

##### `registerBuiltInIndicators(): void`
Registers the built-in definitions (`sma`, `ema`, `wma`, `rsi`, `bollinger`, `vwap`,
`stochastic`, `stochrsi`, `obv`, `mfi`, `forceindex`, `atr`, `adx`, `macd`, `psar`, `cci`,
`williamsr`, `keltner`, `supertrend`, `ichimoku`, `donchian`, `roc`, `swingpoints`). Each
definition is also exported on its own (`SMAIndicator`, `EMAIndicator`, …,
`SwingPointsIndicator`), as is the pure `swingPoints(bars, strength, plotAt?)` function.

---

### IndicatorCalculator

Singleton instance: `indicatorCalculator`. `ChartComponent` uses it internally; call it
directly only if you need indicator values outside the chart.

#### Methods

##### `calculate(instance: IndicatorInstance, bars: OHLCVBar[]): IndicatorOutput[]`
Runs the definition's `calculate`, cached per instance ID. A cached result is reused only
while both the settings (JSON) and a bars fingerprint (length, first and last timestamp,
and the last bar's OHLCV) are unchanged. Returns `[]` and logs an error if the definition
is missing or `calculate` throws; it never throws itself.

```typescript
import { indicatorCalculator } from '@adrienhobbs/candlekit';

const data = indicatorCalculator.calculate(indicatorInstance, bars);
```

##### `invalidateCache(instanceId?: string): void`
Drops one cached result, or all of them. `useChartAPI` calls it when an indicator is
removed or its settings change. Call it yourself if you mutate a bar inside the history
while keeping the length and both end bars the same, since the fingerprint does not see
that.

```typescript
indicatorCalculator.invalidateCache('sma-1'); // one indicator
indicatorCalculator.invalidateCache();        // all
```

##### `getCacheSize(): number`
Returns the number of cached results.

---

### Persistence Adapters

Persistence stores the list of indicator instances (`id`, `definitionId`, `name`,
`settings`). There are two built-in adapters, `localStorage` and `noop`; anything else is
a custom object implementing `PersistenceAdapter`.

#### Factory Function

##### `createPersistenceAdapter(kind: 'noop' | 'localStorage', options?: { key?: string }): PersistenceAdapter`

```typescript
import { createPersistenceAdapter } from '@adrienhobbs/candlekit';

// localStorage under the default key 'chart_indicators'
const shared = createPersistenceAdapter('localStorage');

// One key per chart keeps separate indicator sets; charts sharing a key share one set.
const left = createPersistenceAdapter('localStorage', { key: 'chart_indicators:left' });

// Persistence disabled
const none = createPersistenceAdapter('noop');
```

The default key is exported as `DEFAULT_INDICATORS_STORAGE_KEY` (`'chart_indicators'`).
The adapter classes are also exported: `new LocalStoragePersistenceAdapter(key?)` and
`new NoOpPersistenceAdapter()`.

Create the adapter once (at module level or with `useMemo`), not on every render:
`useChartAPI` reloads indicators whenever the adapter identity changes.

#### PersistenceAdapter Interface

```typescript
interface PersistenceAdapter {
  saveIndicators(indicators: IndicatorInstance[]): Promise<void>;
  loadIndicators(): Promise<IndicatorInstance[]>;
  deleteIndicator(id: string): Promise<void>;
}
```

- `saveIndicators` receives the full current list. `useChartAPI` calls it after every
  change (add, remove, settings update), once loading has finished.
- `loadIndicators` is called by `useChartAPI` on mount and when the adapter changes.
- `deleteIndicator` is part of the interface for direct use; `useChartAPI` does not call
  it (removal is persisted through `saveIndicators`).

A custom adapter, for example backed by your own API:

```typescript
import type { IndicatorInstance, PersistenceAdapter } from '@adrienhobbs/candlekit';

export const apiPersistence: PersistenceAdapter = {
  async saveIndicators(indicators: IndicatorInstance[]) {
    await fetch('/api/indicators', { method: 'PUT', body: JSON.stringify(indicators) });
  },
  async loadIndicators() {
    const res = await fetch('/api/indicators');
    return res.ok ? ((await res.json()) as IndicatorInstance[]) : [];
  },
  async deleteIndicator(id: string) {
    await fetch(`/api/indicators/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
```

---

## React Hooks

### useChartAPI

State for a chart's indicators and price lines, with optional persistence of the
indicators (lines are not persisted).

#### Parameters

```typescript
interface UseChartAPIOptions {
  persistenceAdapter?: PersistenceAdapter;
}
```

#### Returns

```typescript
{
  // Indicators
  indicators: IndicatorInstance[];
  isLoadingIndicators: boolean;   // true until the adapter's loadIndicators resolves
  addIndicator: (definitionId: string, customSettings?: Record<string, any>) => IndicatorInstance;
  removeIndicator: (id: string) => void;
  updateIndicatorSettings: (id: string, settings: Record<string, any>) => void; // replaces the settings object

  // Price lines
  lines: ChartLine[];
  addLine: (
    id: string,
    price: number,
    options?: { color?: string; lineWidth?: number; lineStyle?: 'solid' | 'dashed' | 'dotted'; title?: string },
  ) => void;
  removeLine: (id: string) => void;
  updateLine: (id: string, price: number) => void;
  addEntryLine: (price: number) => void;
  addStopLoss: (price: number) => void;
  addTakeProfit: (price: number) => void;
  addSupportLine: (price: number) => void;
  addResistanceLine: (price: number) => void;
  clearAllLines: () => void;
  addLineByType: (
    type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance',
    price: number,
  ) => void;
}
```

`addLineByType` matches the signature of `ChartComponent`'s `onAddLine`, so it can be
passed straight through.

#### Usage

```tsx
import {
  ChartComponent,
  createPersistenceAdapter,
  registerBuiltInIndicators,
  useChartAPI,
  type OHLCVBar,
} from '@adrienhobbs/candlekit';

registerBuiltInIndicators();
const persistence = createPersistenceAdapter('localStorage', { key: 'my-chart' });

function MyChart({ bars }: { bars: OHLCVBar[] }) {
  const { indicators, lines, addIndicator, updateIndicatorSettings, removeLine, addLineByType } =
    useChartAPI({ persistenceAdapter: persistence });

  return (
    <div style={{ height: 600 }}>
      <button onClick={() => addIndicator('sma', { period: 20 })}>Add SMA(20)</button>
      <button
        onClick={() => {
          const first = indicators[0];
          if (first) updateIndicatorSettings(first.id, { ...first.settings, period: 50 });
        }}
      >
        First indicator to period 50
      </button>
      <ChartComponent
        bars={bars}
        indicators={indicators}
        lines={lines}
        onDeleteLine={removeLine}
        onAddLine={addLineByType}
      />
    </div>
  );
}
```

Because `updateIndicatorSettings` replaces the whole settings object, spread the existing
settings when changing one value.

### useBarsData

Bar state plus an optional `BarDataAdapter` for historical fetches and real-time
subscriptions. Options, return value, and recipes are in the
[Data Management Guide](./data-management.md#using-the-usebarsdata-hook).

### useRealtimeUpdates (legacy)

Still exported but not recommended. It takes `(initialBars, { enabled, updateIntervalMs,
newBarIntervalMs })`, copies the first non-empty `initialBars` once, and then, while
`enabled`, mutates the last bar and appends new bars with **random prices** on timers.
It is a demo simulator, not a data-feed hook. Use `useBarsData` with an adapter instead
(`MockAdapter` for simulated data).

---

## React Components

All dialogs below close on Escape. When several candlekit dialogs are open, Escape closes
only the innermost one, and the key does not reach other Escape handlers on the page (so a
host modal underneath stays open).

### IndicatorBrowser

Modal listing every registered indicator, with search and category filters.

#### Props

```typescript
interface IndicatorBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIndicator: (definitionId: string) => void; // the browser closes itself after calling this
}
```

#### Usage

```tsx
<IndicatorBrowser
  isOpen={isBrowserOpen}
  onClose={() => setIsBrowserOpen(false)}
  onAddIndicator={(id) => addIndicator(id)}
/>
```

---

### SettingsDialog

Modal that edits one indicator instance's settings with a form generated from its
definition.

#### Props

```typescript
interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  indicator: IndicatorInstance | null;   // renders nothing when null
  onSave: (indicatorId: string, settings: Record<string, any>) => void; // full settings object
}
```

#### Usage

```tsx
<SettingsDialog
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  indicator={selectedIndicator}
  onSave={(id, settings) => updateIndicatorSettings(id, settings)}
/>
```

---

### IndicatorSettingsForm

The form used inside `SettingsDialog`, for building your own settings UI. It renders one
control per `SettingField` (`number`, `color` with an opacity slider, `boolean`, `select`,
`lineStyle`).

#### Props

```typescript
interface IndicatorSettingsFormProps {
  settings: IndicatorSettings;              // the definition's settings schema
  currentValues: Record<string, any>;
  onChange: (key: string, value: any) => void;
}
```

#### Usage

```tsx
<IndicatorSettingsForm
  settings={definition.settings}
  currentValues={draftSettings}
  onChange={(key, value) => setDraftSettings((prev) => ({ ...prev, [key]: value }))}
/>
```

---

### LineSettingsDialog

Modal that edits a price line's label, color, style, and width. `ChartComponent` opens it
itself on double-click when `onLineChange` is wired; use it directly for your own "add
line" flow.

```typescript
interface LineSettingsDialogProps {
  isOpen: boolean;
  line: ChartLine | null;           // null closes the dialog
  onClose: () => void;
  onSave: (line: ChartLine) => void; // same id/price/type as the input line
  title?: string;                   // header text, default "Line"
}
```

---

### ChartComponent

The candlestick chart. Minimal usage:

```tsx
<ChartComponent bars={bars} indicators={indicators} lines={lines} onLoadMoreData={loadOlder} />
```

When `height` is omitted the chart fills its container's height (tracked with a
`ResizeObserver`), so give the container a height. The full prop list is in
[ChartComponent Usage → Props Reference](./chart-component.md#props-reference).

### LineChart

Several line series on one pane with an ordinal (not time) x-axis, for comparisons such
as equity curves. Props: `series: LineChartSeries[]`, `theme?`, `height?`, `baseline?`,
`xTickFormatter?`, `valueFormatter?`, `showLegend?`. See
[ChartComponent Usage](./chart-component.md) for details.

---

## Type Definitions

### IndicatorCategory

```typescript
enum IndicatorCategory {
  TREND = 'Trend',
  MOMENTUM = 'Momentum',
  VOLATILITY = 'Volatility',
  VOLUME = 'Volume',
  OSCILLATORS = 'Oscillators',
}
```

### ChartSeriesType

```typescript
enum ChartSeriesType {
  LINE = 'line',
  HISTOGRAM = 'histogram',
  AREA = 'area',
  POINTS = 'points',   // markers on the price pane; NaN = no point
}
```

### RenderConfig

```typescript
interface RenderConfig {
  seriesType: ChartSeriesType;
  outputCount: number;            // required in the TypeScript type (Zod default 1)
  overlay: boolean;               // required in the TypeScript type (Zod default true);
                                  // false = own pane below price; POINTS always draw on the price pane
  hasBandFill?: boolean;
  fillBands?: { upper: string; lower: string };
  priceLineVisible?: boolean;     // default true
  lastValueVisible?: boolean;     // default true
  // POINTS only:
  pointShape?: 'circle' | 'square' | 'arrowUp' | 'arrowDown';   // default 'circle'
  pointPosition?: 'aboveBar' | 'belowBar' | 'atPrice';          // default 'atPrice'
  pointSize?: number;             // default 1 (marker size units)
  pointFields?: string[];         // default ['value'] (outputCount 1) or every field but time
}
```

`RenderConfig` is inferred from `RenderConfigSchema` (Zod). Fields with a Zod default are
required in the inferred type, so an `IndicatorDefinition` literal must set `outputCount`
and `overlay`. `PointShapeSchema` / `PointPositionSchema` validate the POINTS options.
`pointShape`, `pointPosition` and `pointSize` set as instance settings override the
`renderConfig` values. See [Creating Indicators → POINTS](./creating-indicators.md#points).

### SettingFieldType

```typescript
type SettingFieldType = 'number' | 'color' | 'boolean' | 'select' | 'lineStyle';
```

### IndicatorMetadata

```typescript
interface IndicatorMetadata {
  id: string;
  name: string;
  description: string;
  category: IndicatorCategory;
  version: string;   // required in the TypeScript type (Zod default '1.0.0')
}
```

### IndicatorDefinition

```typescript
interface IndicatorDefinition {
  metadata: IndicatorMetadata;
  settings: IndicatorSettings;      // Record<string, SettingField>
  renderConfig: RenderConfig;
  calculate: (bars: OHLCVBar[], settings: Record<string, any>) => IndicatorOutput[];
}
```

### IndicatorInstance

```typescript
interface IndicatorInstance {
  id: string;
  definitionId: string;
  name: string;
  settings: Record<string, any>;
  data?: IndicatorOutput[];
}
```

`IndicatorInstanceSchema` (Zod) validates the persisted shape (without `data`).

### IndicatorOutput

```typescript
interface IndicatorOutput {
  time: number;           // UNIX seconds: bar.timestamp / 1000
  value: number;
  [key: string]: number;  // extra output fields for multi-output indicators
}
```

### SettingField

```typescript
interface SettingField {
  type: SettingFieldType;
  label: string;
  defaultValue: string | number | boolean;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;   // for 'select'
}
```

### Chart and data types

`OHLCVBar`, `ChartLine`, `ChartMarker`, `ChartTrade`, `ChartSignpost`, `ChartRailMarker`,
`PriceBand`, `ChartTheme`, `SessionsConfig`, `SessionDef` (plus the `US_EQUITY_PRESET`
value), `OhlcLegendData`, `OhlcLegendIndicator`, `ChartComponentProps`, `VolumeMode`,
`ContextMenuItem`, `LineChartSeries` and `LineChartProps` are documented in
[ChartComponent Usage](./chart-component.md) and [Theming](./theming.md). The adapter
types (`BarDataAdapter`, `BarDataAdapterOptions`, `HistoricalDataParams`,
`RealtimeHandlers`, `RealtimeSubscription`) are in the
[Data Management Guide](./data-management.md#creating-custom-adapters).

---

## Utility Functions

### Calculation Utilities

Exported from the package root. Each returns one value per bar, `NaN` during warm-up.

#### `calculateSMA(bars: OHLCVBar[], period: number): number[]`
Simple moving average of closes.

#### `calculateEMA(bars: OHLCVBar[], period: number): number[]`
Exponential moving average of closes, seeded with the SMA of the first `period` closes.
The seed is a plain sum, so a `NaN` close in the first `period` bars makes the whole
result `NaN`.

#### `calculateRSI(bars: OHLCVBar[], period: number): number[]`
Wilder's RSI. `NaN` for indices below `period`.

#### `calculateBollingerBands(bars: OHLCVBar[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] }`
SMA middle band with population standard deviation bands.

#### `calculateStandardDeviation(values: number[], period: number): number[]`
Rolling population standard deviation of an arbitrary series.

#### `padIndicatorArray(result: number[], barsLength: number): number[]`
Left-pads a shorter result (as returned by many TA libraries) with `NaN` to `barsLength`.

#### `displaceArray(arr: number[], offset: number): number[]`
Shifts values `offset` places earlier, filling the end with `NaN`.

```typescript
import { calculateSMA, calculateBollingerBands } from '@adrienhobbs/candlekit';

const sma = calculateSMA(bars, 20);
const { upper, middle, lower } = calculateBollingerBands(bars, 20, 2);
```

### Bar utilities

`validateBar`, `isValidBar`, `normalizeTimestamp`, `sortBars`, `deduplicateBars`,
`mergeBars`, `validateAndNormalizeBars`, `updateBarInArray`, `appendBar`, `prependBars`,
`getOldestBar`, `getNewestBar`, `updateCurrentBar`. See
[Data Management → Data Utilities](./data-management.md#data-utilities).

---

## Error Handling

- `indicatorRegistry.get('unknown')` returns `undefined`; `createInstance('unknown')`
  throws.
- `indicatorRegistry.validateSettings('sma', { period: 'invalid' })` returns `false`.
- `indicatorCalculator.calculate` catches errors from a definition's `calculate`, logs
  them, and returns `[]`, so a broken indicator draws nothing instead of crashing the
  chart.
- `ChartComponent` skips instances whose `definitionId` is not registered (for example a
  persisted custom indicator whose definition was not registered on this page).

---

For indicator definitions to copy from, see [Examples](./examples.md).
