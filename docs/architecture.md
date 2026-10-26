# Architecture

How candlekit is put together: the chart component and its hooks, the canvas
primitives, the indicator system, and the data layer. Paths are relative to `src/` in the
candlekit repository; consumers use the named exports of `@adrienhobbs/candlekit`.

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ Host application                                                 │
│   your state, useChartAPI, useBarsData, your own UI              │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ bars, indicators, lines,     │ adapters
                │ trades, markers, ...         │ (Alpaca, Mock, custom)
┌───────────────┴──────────────┐  ┌────────────┴───────────────────┐
│ Components                   │  │ Data layer                     │
│ ChartComponent, LineChart,   │  │ BarDataAdapter, useBarsData,   │
│ IndicatorBrowser,            │  │ barUtils                       │
│ SettingsDialog, ...          │  └────────────────────────────────┘
└───────────────┬──────────────┘
                │ chart-hooks/* (one concern each)
┌───────────────┴──────────────────────────────────────────────────┐
│ lightweight-charts v5: series, panes, markers plugins,           │
│ series primitives (Bands, Sessions, TradeOverlays, Annotations)  │
└───────────────┬──────────────────────────────────────────────────┘
                │ indicator data
┌───────────────┴──────────────────────────────────────────────────┐
│ Indicator system: registry, calculator (cache), persistence,     │
│ built-in definitions                                             │
└──────────────────────────────────────────────────────────────────┘
```

`ChartComponent` holds no data of its own beyond view state (selection, popups, drag).
The host owns bars, indicators and lines and passes them as props; the component diffs
them into lightweight-charts.

## Directory Structure

```
src/
├── index.ts                  # Public barrel (the package entry)
├── lib.css                   # Tailwind entry compiled to dist/styles.css
├── App.tsx, main.tsx         # Dev harness / demo, not exported
├── adapters/
│   ├── types.ts              # BarDataAdapter, HistoricalDataParams, RealtimeHandlers, ...
│   ├── alpaca.ts             # AlpacaBarAdapter (REST bars + IEX WebSocket)
│   └── mock.ts               # MockAdapter (random-walk bars)
├── components/
│   ├── ChartComponent.tsx    # Candlestick chart; composes the chart-hooks below
│   ├── LineChart.tsx         # Ordinal-x multi-line chart
│   ├── IndicatorBrowser.tsx  # Indicator picker modal
│   ├── SettingsDialog.tsx    # Indicator settings modal
│   ├── IndicatorSettingsForm.tsx  # Form generated from a settings schema
│   ├── LineSettingsDialog.tsx     # Price-line edit modal
│   ├── OhlcLegend.tsx        # Default crosshair OHLC legend
│   ├── useDialogEscape.ts    # Shared Escape stack for the dialogs
│   ├── chart-constants.ts    # Layout and interaction constants
│   ├── bars-sync-plan.ts     # Pure: setData vs. update vs. nothing
│   ├── transformSeriesData.ts # Indicator outputs to series points (drop or gap NaN)
│   ├── indicator-points.ts   # Pure: POINTS outputs to series markers
│   ├── trade-markers.ts      # Pure: trades to entry/exit markers
│   ├── annotations-layout.ts # Pure: signpost pill rows, rail mark offsets
│   ├── lineChartData.ts      # Pure: ordinal points to line data
│   ├── ohlcLegendData.ts     # Pure: legend values and change math
│   └── chart-hooks/
│       ├── useChartLifecycle.ts  # Create/destroy chart + series, resize, pointer handling, load-more
│       ├── useBarsSync.ts        # Feed bars into candle + volume series
│       ├── useIndicatorSeries.ts # Build/refresh indicator series, panes, POINTS markers
│       ├── usePriceLines.ts      # Price lines + delete buttons
│       ├── usePriceBands.ts      # Full-width shaded price bands
│       ├── useTradeOverlays.ts   # Time-bounded line segments and boxes
│       ├── useTradeMarkers.ts    # Trade entry/exit + host markers + selected-bar marker
│       ├── useAnnotations.ts     # Signposts, event rail, price-style and hollow markers
│       ├── useSessions.ts        # Session shading + day separators
│       ├── useSpotlight.ts       # Selected-bar highlight
│       ├── useTradeFocus.ts      # Scroll a focused trade into view
│       ├── usePopupPosition.ts   # Trade popup anchoring
│       ├── useOhlcLegend.ts      # Crosshair legend data
│       └── useHoverBar.ts        # onHoverBar callback
├── contexts/
│   └── ChartAPIContext.tsx   # Provider wrapper around useChartAPI (dev harness; not exported)
├── hooks/
│   ├── useChartAPI.ts        # Indicator + price-line state, persistence
│   ├── useBarsData.ts        # Bar state + adapter fetch/subscribe
│   └── useRealtimeUpdates.ts # Legacy random-price simulator (still exported)
├── indicators/
│   ├── index.ts              # Indicator barrel
│   ├── core/
│   │   ├── types.ts          # Zod schemas + types (definitions, settings, render config)
│   │   ├── registry.ts       # indicatorRegistry
│   │   ├── calculator.ts     # indicatorCalculator (cached)
│   │   ├── persistence.ts    # PersistenceAdapter, localStorage / noop adapters
│   │   └── settings.ts       # numberSetting / colorSetting / lineWidthSetting builders
│   ├── registry/             # 23 built-in definitions + registerBuiltInIndicators
│   ├── primitives/
│   │   ├── BandsPrimitive.ts         # Fill between upper/lower band series
│   │   ├── SessionsPrimitive.ts      # Session shading, day separators
│   │   ├── TradeOverlaysPrimitive.ts # Bounded segments and boxes with labels
│   │   ├── AnnotationsPrimitive.ts   # Signposts, rail, ▶/◀ and hollow markers
│   │   └── overlay-geometry.ts       # Shared time-span clamping
│   └── utils/
│       └── calculations.ts   # SMA, EMA, RSI, Bollinger, std dev, padding helpers
├── sessions/
│   └── sessions.ts           # Pure session classification + US_EQUITY_PRESET
├── constants/
│   └── colors.ts             # Shared palette, band fill, win/loss colors
├── types/
│   └── chart.ts              # OHLCVBar, ChartLine, ChartTrade, ChartMarker, ChartTheme, ...
└── utils/
    ├── barUtils.ts           # Bar validation, sorting, merging, live updates
    ├── chartTheme.ts         # DEFAULT_CHART_THEME, shared layout options
    └── nearestLine.ts        # Pure hit-testing for line drag/edit
```

Pure modules (no lightweight-charts or DOM) sit next to the hook or primitive that uses
them and have unit tests beside them (`*.test.ts`).

## Chart Component

`ChartComponent` is a thin composition of hooks in `components/chart-hooks/`, each owning
one concern. They share refs created in the component (chart, candlestick series, volume
series, indicator series map, price-line map) rather than state, so updates go straight
to lightweight-charts without re-rendering React.

- **Create once, apply options.** `useChartLifecycle` creates the chart and the candle and
  volume series once per mount. Prop changes (theme, height, time zone, session config)
  are applied with `applyOptions` or by updating a primitive in place, never by
  recreating the chart.
- **Bars diffing.** `useBarsSync` sorts and dedupes `bars`, then `planBarsSync` decides:
  `update` when only the last bar changed (a forming bar ticking), `set` for anything else
  (first load, prepended history, a different symbol), `none` when nothing changed. All
  bars but the last are compared, because two symbols over the same window share
  timestamps.
- **Load more.** When the visible logical range starts within 5 bars of the left edge,
  `onLoadMoreData(oldestTimestamp)` fires once; it re-arms after `bars` grows.
- **Sizing.** With `height` set the chart is that tall; without it the chart follows its
  container's height.
- **Primitives.** Drawing that series cannot do is done by series primitives attached to
  the candlestick series: `SessionsPrimitive`, `TradeOverlaysPrimitive` (bounded
  `ChartLine` segments and `PriceBand` boxes) and `AnnotationsPrimitive` (signposts, the
  event rail, `▶`/`◀` and hollow markers, `markerStyle: 'price'` trade marks).
  `BandsPrimitive` is attached to an indicator's upper band series for band fills.
- **Markers.** Trade markers and host `markers` share one lightweight-charts markers plugin.
  Each POINTS indicator field gets its own plugin, so indicator points never replace them.
- **Dialogs.** `IndicatorBrowser`, `SettingsDialog` and `LineSettingsDialog` register with
  `useDialogEscape`, a stack with one capture-phase `keydown` listener on `window`. Escape
  closes only the innermost open dialog and stops propagation.

## Indicator System

### Type System (`indicators/core/types.ts`)

Definitions are described by Zod schemas, from which the TypeScript types are inferred:

```typescript
interface IndicatorDefinition {
  metadata: IndicatorMetadata;       // id, name, description, category, version
  settings: IndicatorSettings;       // Record<string, SettingField>
  renderConfig: RenderConfig;        // seriesType, outputCount, overlay, bands, POINTS options
  calculate: (bars: OHLCVBar[], settings: Record<string, any>) => IndicatorOutput[];
}

interface IndicatorInstance {
  id: string;              // e.g. 'sma-1'
  definitionId: string;    // e.g. 'sma'
  name: string;            // e.g. 'SMA(1)'
  settings: Record<string, any>;
  data?: IndicatorOutput[];
}
```

`IndicatorOutput.time` is in UNIX seconds (`bar.timestamp / 1000`), the unit
lightweight-charts uses. Full shapes are in the [API Reference](./api-reference.md#type-definitions).

### Registry (`indicators/core/registry.ts`)

A module-level singleton, `indicatorRegistry`, mapping `metadata.id` to a definition. It
starts empty; `registerBuiltInIndicators()` registers the built-ins and hosts
`register()` their own. `createInstance` fills defaults from the settings schema and
names instances from a per-definition counter (`sma-1`, `sma-2`, …).

Because the registry is a singleton, every chart on the page sees the same set of
definitions.

### Calculator (`indicators/core/calculator.ts`)

`indicatorCalculator.calculate(instance, bars)` runs the definition and caches the result
per instance ID. A cached entry is reused only while:

- the settings serialize to the same JSON, and
- the bars fingerprint matches: bar count, first and last timestamp, and the last bar's
  OHLCV.

Bar count alone is not enough: switching symbol or window usually yields the same number
of bars. The fingerprint is O(1) because `calculate` runs on every bars update. A
mutation strictly inside the history that keeps the length and both ends unchanged is not
detected; call `invalidateCache` in that case.

### Persistence (`indicators/core/persistence.ts`)

```typescript
interface PersistenceAdapter {
  saveIndicators(indicators: IndicatorInstance[]): Promise<void>;
  loadIndicators(): Promise<IndicatorInstance[]>;
  deleteIndicator(id: string): Promise<void>;
}
```

Built in: `LocalStoragePersistenceAdapter` (key `chart_indicators` by default) and
`NoOpPersistenceAdapter`, created with `createPersistenceAdapter('localStorage' | 'noop',
{ key? })`. Charts that should keep separate indicator sets need separate keys. Any other
backend is a custom object implementing the interface.

### Rendering (`components/chart-hooks/useIndicatorSeries.ts`)

When the `indicators` prop changes, every indicator series is removed and rebuilt; when
`bars` changes, the existing series are re-fed. Per definition:

| renderConfig | Rendered as |
|---|---|
| `LINE`, `outputCount: 1` | One line series; non-finite values become whitespace, so the line breaks there |
| `LINE` with `hasBandFill` + `fillBands` | Upper, middle and lower line series plus a `BandsPrimitive` fill (unless `showFill` is `false`) |
| `LINE`, `outputCount > 1`, no band fill | One series per output field; a field named `histogram` is a histogram, others are lines |
| `HISTOGRAM` | One histogram series |
| `AREA` | One area series (`topColor`, `bottomColor`, `lineColor` settings) |
| `POINTS` | Series markers on the candlestick series, one markers plugin per drawn field |

`overlay: false` puts the indicator in its own pane below the volume pane (pane index 2
and up); POINTS always draw on the price pane. Colors come from instance settings
(`color`, `<field>Color`, `upperColor`/`middleColor`/`lowerColor`, `fillColor`), falling
back to a shared palette.

### Settings forms (`components/IndicatorSettingsForm.tsx`)

The settings dialog renders one control per `SettingField` type: `number`, `color` (with
an opacity slider, stored as hex or `rgba(...)`), `boolean`, `select`, `lineStyle`. A new
indicator needs no UI code.

## Data Layer

```
Provider ──► BarDataAdapter ──► useBarsData ──► bars ──► <ChartComponent bars={bars} />
            (fetchHistoricalBars,   (validate, sort,
             subscribeRealtime)      dedupe, live updates)
```

Adapters convert a provider's format to `OHLCVBar` (timestamps in epoch milliseconds).
`useBarsData` is optional; any code that produces an `OHLCVBar[]` can drive the chart.
See the [Data Management Guide](./data-management.md).

## Data Flow

### Adding an Indicator

```
User picks an indicator in IndicatorBrowser
  → onAddIndicator(definitionId)
  → useChartAPI.addIndicator → indicatorRegistry.createInstance (defaults + custom settings)
  → indicators state updated → persistenceAdapter.saveIndicators(all)
  → ChartComponent: useIndicatorSeries rebuilds series → indicatorCalculator.calculate
```

### Updating Settings

```
SettingsDialog → onSave(id, settings)
  → useChartAPI.updateIndicatorSettings → indicatorCalculator.invalidateCache(id)
  → persistenceAdapter.saveIndicators(all)
  → series rebuilt with the new settings
```

### Loading from Persistence

```
useChartAPI mounts (or the adapter identity changes)
  → persistenceAdapter.loadIndicators()
  → indicators state set, isLoadingIndicators = false
  → ChartComponent renders instances whose definitionId is registered
```

Saving only starts after the load resolves, so a slow load cannot overwrite stored
indicators with an empty list.

## Design Principles

- **Host owns the data.** The chart renders what it is given; no fetching, no hidden
  stores. Props that are arrays should be memoized, since a new identity re-applies them.
- **Extensible without forking.** Indicators are registered at run time, adapters and
  persistence are interfaces, and render options live on the definition.
- **Pure core, thin hooks.** Data shaping (bars diffing, markers, legend math, session
  classification, overlay geometry) lives in pure, unit-tested modules; hooks only wire it
  to lightweight-charts.
- **Canvas theming via props, DOM theming via CSS.** The canvas takes a `ChartTheme`; the
  modals read `--ck-*` CSS variables. See [Theming](./theming.md).

## Performance Characteristics

- Registry and cache lookups are `Map` lookups.
- Indicator calculation is O(n) per indicator for most built-ins and is skipped on a cache
  hit.
- A forming bar that ticks is applied with a single `update` call on the candle and volume
  series instead of `setData`. Indicator series are currently re-fed with `setData` on
  every bars change.
- Changing the `indicators` array rebuilds all indicator series, so keep its identity
  stable between real changes.

## Testing

Unit tests (Vitest) sit beside the code: the calculator cache, the registry and built-in
defaults, calculation utilities, swing points, sessions, overlay geometry, bars diffing,
markers, legend data, and the hooks' pure helpers. Run them with `npm test`.
