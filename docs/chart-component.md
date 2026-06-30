# ChartComponent Usage Guide

A comprehensive guide to using the ChartComponent in your trading application.

> 🔗 **[Live demo](https://adrienhobbs.github.io/candlestick-chart/)** — drag/edit lines, hover a
> trade for time-bounded overlays, toggle indicators + sessions + the OHLC legend.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Data Format](#data-format)
- [Props Reference](#props-reference)
- [Features](#features)
- [Event Callbacks](#event-callbacks)
- [Chart Interactions](#chart-interactions)
- [Styling](#styling)
- [Data Management](#data-management)
- [Integration Examples](#integration-examples)
- [Persistence Options](#persistence-options)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [TypeScript Types](#typescript-types)

## Introduction

ChartComponent is a pure presentation component for displaying candlestick charts with volume, technical indicators, and price lines. It's built on [TradingView's Lightweight Charts](https://tradingview.github.io/lightweight-charts/) library and provides a rich, interactive trading chart experience.

### Key Features

- **Candlestick Charts**: Display OHLCV data with automatic color coding
- **Volume Display**: Integrated volume histogram below the price chart
- **Technical Indicators**: Support for overlay and separate pane indicators
- **Price Lines**: Draw entry, stop loss, and take profit lines
- **Trade Markers & Popup**: Mark trades (entry/exit, win/loss colored) with a details popup
- **Bar Selection**: Click — or control externally (e.g. arrow keys) — to select and inspect bars
- **Infinite Scroll**: Load historical data as users scroll back in time
- **Context Menu**: Right-click to add price lines at specific levels
- **Theming**: Theme the chart canvas (`theme` prop) and modals (`--ck-*` CSS vars)
- **Provider Agnostic**: Works with any data source and persistence layer

### When to Use

Use ChartComponent when you need to:
- Display candlestick price data
- Visualize technical indicators
- Allow users to interact with chart data
- Build trading interfaces with entry/exit levels
- Integrate charting into your trading application

## Installation

Import the component and required types:

```typescript
import ChartComponent from './components/ChartComponent';
import { OHLCVBar, ChartLine } from './types/chart';
import { IndicatorInstance } from './indicators/core/types';
```

## Basic Usage

### Minimal Example

The simplest use case requires only the `bars` prop:

```typescript
import { useState } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function MyChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([
    {
      timestamp: 1700000000000,
      open: 100.5,
      high: 101.2,
      low: 100.0,
      close: 100.8,
      volume: 1000000,
    },
    // ... more bars
  ]);

  return <ChartComponent bars={bars} />;
}
```

### Complete Example

A full-featured implementation with all capabilities:

```typescript
import { useState } from 'react';
import ChartComponent from './components/ChartComponent';
import { useChartAPI } from './hooks/useChartAPI';
import { OHLCVBar } from './types/chart';

function TradingChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);

  const {
    lines,
    indicators,
    addLineByType,
    removeLine,
    addIndicator,
    removeIndicator,
  } = useChartAPI();

  const handleLoadMore = async (oldestTimestamp: number) => {
    // Fetch older data from your API
    const olderBars = await fetchHistoricalData(oldestTimestamp);
    setBars(prev => [...olderBars, ...prev]);
  };

  const handleBarClick = (bar: OHLCVBar | null) => {
    setSelectedBar(bar);
    console.log('Selected bar:', bar);
  };

  return (
    <ChartComponent
      bars={bars}
      indicators={indicators}
      lines={lines}
      onLoadMoreData={handleLoadMore}
      onBarClick={handleBarClick}
      onAddLine={addLineByType}
      onDeleteLine={removeLine}
      enableBarSelection={true}
    />
  );
}
```

## Data Format

### OHLCVBar Interface

ChartComponent expects data in the following format:

```typescript
interface OHLCVBar {
  timestamp: number;      // Unix timestamp in milliseconds
  open: number;          // Opening price
  high: number;          // Highest price
  low: number;           // Lowest price
  close: number;         // Closing price
  volume: number;        // Trading volume
  trade_count?: number;  // Optional: number of trades
  vwap?: number;        // Optional: volume-weighted average price
}
```

### Timestamp Format

**Important**: Timestamps must be in **milliseconds** (not seconds).

```typescript
// ✅ Correct: Milliseconds
{ timestamp: 1700000000000 }

// ❌ Wrong: Seconds
{ timestamp: 1700000000 }
```

If your data source provides Unix timestamps in seconds, convert them:

```typescript
const bars = apiData.map(bar => ({
  ...bar,
  timestamp: bar.timestamp * 1000, // Convert seconds to milliseconds
}));
```

### Example Bar Data

```typescript
const bars: OHLCVBar[] = [
  {
    timestamp: 1700000000000,  // Nov 14, 2023 22:13:20 GMT
    open: 15.95,
    high: 15.95,
    low: 15.91,
    close: 15.91,
    volume: 400,
    trade_count: 4,
    vwap: 15.9275,
  },
  {
    timestamp: 1700000300000,  // 5 minutes later
    open: 15.86,
    high: 15.86,
    low: 15.86,
    close: 15.86,
    volume: 100,
    trade_count: 1,
    vwap: 15.86,
  },
];
```

### Data Requirements

- Bars should be **sorted by timestamp** (ascending order)
- No duplicate timestamps (component handles deduplication)
- All required fields must be present
- Prices should be positive numbers
- Volume should be non-negative

## Props Reference

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `bars` | `OHLCVBar[]` | Array of candlestick data to display |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onLoadMoreData` | `(oldestTimestamp: number) => void` | - | Callback when user scrolls to load older data |
| `indicators` | `IndicatorInstance[]` | `[]` | Array of indicator instances to display |
| `lines` | `ChartLine[]` | `[]` | Array of price lines to draw |
| `onBarUpdate` | `(bar: OHLCVBar) => void` | - | Callback when current bar updates |
| `onNewBar` | `(bar: OHLCVBar) => void` | - | Callback when new bar is created |
| `onDeleteLine` | `(lineId: string) => void` | - | Callback when a line's delete button is clicked |
| `onAddLine` | `(type, price) => void` | - | Built-in menu: add a typed line at the price (see [Context Menu](#context-menu)) |
| `onClearAllLines` | `() => void` | - | Built-in menu: clear all lines |
| `onLineMove` | `(lineId: string, price: number) => void` | - | Drag a line to reprice it; fires on release (see [Interactive Lines](#interactive-lines)) |
| `onLineChange` | `(line: ChartLine) => void` | - | Double-click a line to edit it in the built-in dialog; fires on save (see [Interactive Lines](#interactive-lines)) |
| `contextMenuItems` | `({ price }) => ContextMenuItem[]` | - | Replace the built-in menu with your own items (see [Context Menu](#context-menu)) |
| `enableBarSelection` | `boolean` | `true` | Enable/disable bar selection feature |
| `onBarClick` | `(bar: OHLCVBar \| null) => void` | - | Callback when bar is clicked or deselected |
| `selectedBarTime` | `number \| null` | uncontrolled | Externally control the selected bar (spotlight) by ms timestamp — lets a parent move the selection (e.g. arrow keys). See [Bar Selection](#bar-selection) |
| `trades` | `ChartTrade[]` | `[]` | Trades to mark on the chart (entry/exit arrows, colored by win/loss) |
| `selectedTradeId` | `string \| null` | `null` | Highlights + labels the matching trade's markers |
| `focusTradeId` | `string \| null` | `null` | Scrolls/frames the matching trade into view |
| `renderTradePopup` | `(trade: ChartTrade) => ReactNode` | - | Render a popup for the trade under the selected bar. See [Trade Markers & Popup](#trade-markers--popup) |
| `priceBands` | `PriceBand[]` | `[]` | Shaded horizontal price bands (e.g. an MFE↔MAE zone) |
| `onHoverBar` | `(timeMs: number \| null) => void` | - | Fired with the hovered bar's time (ms) as the crosshair moves; `null` when the cursor leaves. See [Interactive Lines](#interactive-lines) |
| `timeZone` | `string` | viewer local | IANA timezone for axis ticks + crosshair labels |
| `height` | `number` | auto-fill | Fixed chart height in px (omit to fill the container) |
| `theme` | `Partial<ChartTheme>` | slate dark | Chart canvas colors — background, grid, axes, candles, volume. See [Theming](./theming.md) |

> **Theming the chart and its modals** — the chart canvas takes a `theme` prop;
> the indicator browser / settings dialog read `--ck-*` CSS variables. Both are
> covered in **[Theming](./theming.md)**.

## Features

### Infinite Scroll (Load More Data)

The infinite scroll feature automatically triggers when users pan back to view older data.

#### How It Works

1. User scrolls/pans to the left edge of the chart
2. When within 5 bars of the start, `onLoadMoreData` is called
3. Component shows "Loading more data..." indicator
4. Your callback fetches and prepends older bars
5. Chart updates with new data

#### Implementation

```typescript
const handleLoadMore = async (oldestTimestamp: number) => {
  try {
    // Fetch data older than the provided timestamp
    const response = await fetch(
      `/api/bars?before=${oldestTimestamp}&limit=100`
    );
    const olderBars = await response.json();

    // Prepend to existing bars
    setBars(prev => [...olderBars, ...prev]);
  } catch (error) {
    console.error('Failed to load historical data:', error);
  }
};

<ChartComponent
  bars={bars}
  onLoadMoreData={handleLoadMore}
/>
```

#### Best Practices

- Fetch 50-200 bars per request (balance between performance and UX)
- Show loading state in your UI
- Handle errors gracefully
- Prevent duplicate requests with a loading flag
- Cache fetched data to avoid redundant API calls

### Bar Selection

Click any bar to select it and view detailed information.

#### Features

- Visual spotlight overlay on selected bar
- Marker above the selected bar
- Deselect by clicking the same bar again
- Callback provides full bar data

#### Implementation

```typescript
const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);

const handleBarClick = (bar: OHLCVBar | null) => {
  setSelectedBar(bar);

  if (bar) {
    console.log('Bar selected:', {
      time: new Date(bar.timestamp).toLocaleString(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    });
  } else {
    console.log('Bar deselected');
  }
};

<ChartComponent
  bars={bars}
  enableBarSelection={true}
  onBarClick={handleBarClick}
/>
```

#### Disabling Selection

```typescript
<ChartComponent
  bars={bars}
  enableBarSelection={false}
/>
```

#### Controlled Selection (`selectedBarTime`)

By default the selection is **uncontrolled** — clicking toggles it internally.
Pass `selectedBarTime` (a ms timestamp, or `null`) to make it **controlled**: the
spotlight follows the prop, while clicks still fire `onBarClick` so you can update
it. This lets a parent move the selection — e.g. with arrow keys:

```tsx
const [selectedBarTime, setSelectedBarTime] = useState<number | null>(bars.at(-1)?.timestamp ?? null);

// arrow keys step the selection one bar at a time
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = bars.findIndex((b) => b.timestamp === selectedBarTime);
    const j = Math.max(0, Math.min(bars.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    setSelectedBarTime(bars[j].timestamp);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [bars, selectedBarTime]);

<ChartComponent
  bars={bars}
  selectedBarTime={selectedBarTime}
  onBarClick={(bar) => setSelectedBarTime(bar?.timestamp ?? null)}
/>
```

### Price Lines

Draw horizontal lines on the chart for entry points, stop losses, and take profit levels.

#### ChartLine Interface

```typescript
interface ChartLine {
  id: string;
  price: number;
  color: string;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  title?: string;
  type?: 'entry' | 'stopLoss' | 'takeProfit';
  deletable?: boolean;  // default true; set false to hide the delete button (read-only line)
  draggable?: boolean;  // default true; set false to make the line non-draggable (read-only line)
  editable?: boolean;   // default true; set false to disable double-click-to-edit (read-only line)
}
```

`deletable` / `draggable` / `editable` are independent. A derived/read-only line (e.g. a
trade overlay) should set all three to `false`.

#### Adding Lines Programmatically

```typescript
const [lines, setLines] = useState<ChartLine[]>([]);

const addEntryLine = (price: number) => {
  const newLine: ChartLine = {
    id: `entry-${Date.now()}`,
    price: price,
    color: '#3b82f6',
    lineWidth: 2,
    lineStyle: 'solid',
    title: 'Entry',
  };
  setLines(prev => [...prev, newLine]);
};

const addStopLoss = (price: number) => {
  const newLine: ChartLine = {
    id: `sl-${Date.now()}`,
    price: price,
    color: '#ef4444',
    lineWidth: 2,
    lineStyle: 'dashed',
    title: 'Stop Loss',
  };
  setLines(prev => [...prev, newLine]);
};

<ChartComponent
  bars={bars}
  lines={lines}
  onDeleteLine={(id) => setLines(prev => prev.filter(l => l.id !== id))}
/>
```

#### Interactive Delete

Each line has a delete button (red × icon) positioned on the right side of the chart. Click to remove the line. Set `deletable: false` on a line to hide its delete button — useful for derived/read-only lines (e.g. a trade overlay) that shouldn't be removed.

### Interactive Lines

Two opt-in interactions let the user adjust a line directly on the chart:

- **Drag to reprice** — wire `onLineMove`. Grab any line (cursor turns `ns-resize`),
  drag it vertically, and it follows the cursor live. On release, `onLineMove(id, price)`
  fires with the new price; update the line's `price` in `lines` to persist it. The chart
  doesn't pan while you drag a line.
- **Double-click to edit** — wire `onLineChange`. Double-clicking a line opens the
  built-in `LineSettingsDialog` (label / color / style / width). On save,
  `onLineChange(line)` fires with the edited line (same `id`/`price`); merge it into `lines`.
  (Wiring `onLineChange` opts into the built-in dialog — don't also render your own off it.)

Both are gated per-line: a line with `draggable: false` can't be dragged, and one with
`editable: false` won't open the dialog. Read-only overlays should set both `false`.

```tsx
<ChartComponent
  bars={bars}
  lines={lines}
  onLineMove={(id, price) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, price } : l)))
  }
  onLineChange={(line) =>
    setLines((prev) => prev.map((l) => (l.id === line.id ? line : l)))
  }
/>
```

### Time-bounded overlays (segments + boxes)

By default a `ChartLine` is an **infinite** horizontal price line and a `PriceBand` is a
**full-width** shaded band. Give either one BOTH `startTime` and `endTime` (epoch ms,
matching `OHLCVBar.timestamp`) and it instead renders as a **time-bounded** overlay drawn on
the canvas — a line **segment** spanning `[startTime, endTime]` at its price, or a **box**
spanning `[startTime, endTime] × [top, bottom]` — that **auto-hides when its window scrolls
out of view**. This is the "position tool" look: anchor a trade's entry/stop/target + its
MFE↔MAE band to the trade's bars so they appear only there.

```tsx
<ChartComponent
  bars={bars}
  lines={[
    // bounded segment (read-only): spans only the trade window, hides when scrolled away
    { id: 'entry', price: 158.2, color: '#9ca3af', title: 'Entry', lineStyle: 'solid',
      startTime: entryMs, endTime: exitMs, deletable: false, draggable: false, editable: false },
  ]}
  priceBands={[
    { id: 'mfeMae', top: 158.7, bottom: 157.4, color: 'rgba(59,130,246,0.12)',
      startTime: entryMs, endTime: exitMs },
  ]}
/>
```

Bounded overlays are read-only (no axis label, delete button, drag, or edit) and draw an
optional inline title at the segment's left end. Endpoints should align to real bar timestamps.
Pair with `onHoverBar` to show a trade's overlays only while hovering its bars.

A bounded **box** also takes optional `topLabel` / `bottomLabel` strings, drawn inside the box at
its top / bottom edge — e.g. the favorable `+R` and adverse `−R` of an MFE↔MAE excursion.

### Context Menu

Right-click on the chart to open a context menu for adding price lines. The menu
appears only when `onAddLine` or `onClearAllLines` is wired, and it reads the same
`--ck-*` CSS variables as the modals (see [Theming](./theming.md)).

#### Features

- Shows the exact price at the cursor position
- Add **Entry / Stop Loss / Take Profit / Support / Resistance** line at that price
  (`onAddLine(type, price)` — `type` is one of those five)
- **Clear All Lines** (`onClearAllLines`)
- Per-line delete buttons (`onDeleteLine(id)`) when `onDeleteLine` is provided

#### Implementation

```typescript
const COLORS = {
  entry: '#9ca3af', stopLoss: '#ef4444', takeProfit: '#22c55e',
  support: '#3b82f6', resistance: '#f59e0b',
};

const handleAddLine = (
  type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance',
  price: number,
) => {
  setLines((prev) => [
    ...prev,
    { id: `${type}-${Date.now()}`, price, color: COLORS[type], title: type },
  ]);
};

<ChartComponent
  bars={bars}
  lines={lines}
  onAddLine={handleAddLine}
  onDeleteLine={(id) => setLines((prev) => prev.filter((l) => l.id !== id))}
  onClearAllLines={() => setLines([])}
/>
```

#### Custom menu items (`contextMenuItems`)

The built-in five-type menu is just a default. Pass `contextMenuItems` to define the
menu yourself — candlekit still renders the themed/positioned menu (with the price
header); you supply the actions. This is how you offer e.g. a single **"Add
horizontal line"** and own the line's styling.

```tsx
<ChartComponent
  contextMenuItems={({ price }) => [
    { label: 'Add horizontal line', onSelect: () => setEditingLine({ id: nextId(), price, color: '#3b82f6' }) },
    ...(lines.length ? [{ label: 'Clear all', danger: true, onSelect: () => setLines([]) }] : []),
  ]}
  onDeleteLine={(id) => setLines((p) => p.filter((l) => l.id !== id))}
/>
```

Pair it with **`LineSettingsDialog`** — a themed editor (the line-drawing parallel
to `SettingsDialog`) for a line's label / color / style / width:

```tsx
import { LineSettingsDialog } from '@adrienhobbs/candlekit';

<LineSettingsDialog
  isOpen={editingLine != null}
  line={editingLine}
  title="Add Line"
  onClose={() => setEditingLine(null)}
  onSave={(line) => { upsertLine(line); setEditingLine(null); }}
/>
```

### Trade Markers & Popup

Pass `trades` to mark trades on the chart — each gets an entry (▲, belowBar) and
exit (▼, aboveBar) marker, colored by `outcome` (`'win'`/`'loss'`). The win/loss
colors follow the [`theme`](./theming.md)'s `upColor`/`downColor`.

```typescript
interface ChartTrade {
  id: string;
  entryTime: number;   // ms — must equal an entry bar's timestamp
  exitTime: number;    // ms — must equal an exit bar's timestamp
  entryPrice: number;
  exitPrice: number;
  outcome: 'win' | 'loss';
}
```

- **`selectedTradeId`** — the matching trade's markers are emphasized and labeled
  (`entry`/`exit` text).
- **`focusTradeId`** — scrolls/frames the matching trade into view (pairs with
  `selectedTradeId` to drive both selection and focus).
- **`renderTradePopup`** — render a floating popup with trade details. The popup
  follows the **selected bar** (see [Controlled Selection](#controlled-selection-selectedbartime)):
  it shows for the trade whose span `[entryTime, exitTime]` contains the selected
  bar — so **every bar of a trade** shows it (anchored at the bar), and a bar
  outside all trades shows none.

```tsx
<ChartComponent
  bars={bars}
  trades={trades}
  selectedTradeId={selectedId}
  focusTradeId={selectedId}
  selectedBarTime={selectedBarTime}
  renderTradePopup={(trade) => (
    <div className="trade-popup">
      {trade.outcome} · entry {fmt(trade.entryTime)} · exit {fmt(trade.exitTime)}
    </div>
  )}
/>
```

### LineChart — overlay multiple line series

`LineChart` is a separate, lightweight component (not `ChartComponent`) for plotting
several line series on **one shared pane** for comparison — e.g. per-split equity
curves aligned at trade #0. Its x-axis is **ordinal, not time**: you pass `{ x, y }`
where `x` is an index (trade #), and candlekit feeds the integer to lightweight-charts
as the time field while overriding the tick/crosshair formatters to render the ordinal.
(Don't convert `x` to real timestamps — the data has no time dimension.)

```tsx
import { LineChart, type LineChartSeries } from '@adrienhobbs/candlekit';

const series: LineChartSeries[] = [
  { id: 'discovery',  label: 'discovery',  color: '#3b82f6', data: discovery.map((y, x) => ({ x, y })) },
  { id: 'validation', label: 'validation', color: '#f59e0b', data: validation.map((y, x) => ({ x, y })) },
  { id: 'holdout',    label: 'holdout',    color: '#14b8a6', data: holdout.map((y, x) => ({ x, y })) },
];

<LineChart
  series={series}
  theme={chartTheme}                 // same ChartTheme as ChartComponent; candle fields ignored
  height={220}
  baseline={0}                       // dashed zero line, kept in view via autoscale
  xTickFormatter={(x) => `#${x}`}
  valueFormatter={(y) => `${y >= 0 ? '+' : ''}${y.toFixed(2)}R`}
/>
```

| Prop | Type | Notes |
|------|------|-------|
| `series` | `LineChartSeries[]` | Overlaid on one pane; later entries draw on top. Series may differ in length (all start at x=0; a shorter one just ends earlier). |
| `theme` | `Partial<ChartTheme>` | Reuses the [chart theme](./theming.md); candle/volume fields are ignored. Re-applied live. |
| `height` | `number` | Fixed px; omit to fill the container (ResizeObserver). |
| `baseline` | `number` | Dashed horizontal reference line (e.g. `0`), merged into the price range so it stays visible even when all curves are positive. |
| `xTickFormatter` | `(x:number)=>string` | Axis ticks **and** crosshair label. Default `String(x)`. |
| `valueFormatter` | `(y:number)=>string` | Price axis, legend, hover readout. Default `String(y)`. |
| `showLegend` | `boolean` | Overlay legend (swatch + label + value); follows the crosshair, falls back to each series' final value. Default `true`. |

```ts
interface LineChartSeries {
  id: string;                                 // stable identity (reconcile across renders)
  label?: string;                             // legend text; falls back to id
  color: string;
  lineWidth?: number;                         // default 2
  lineStyle?: 'solid' | 'dashed' | 'dotted';  // default 'solid'
  data: { x: number; y: number }[];           // x = ordinal (ascending, unique); y = value
}
```

### Indicators

Display technical indicators on the chart. Indicators can be overlaid on the price chart or shown in separate panes below.

#### Adding Indicators

```typescript
import { useChartAPI } from './hooks/useChartAPI';

function MyChart() {
  const { indicators, addIndicator, removeIndicator } = useChartAPI();

  return (
    <>
      <button onClick={() => addIndicator('sma')}>Add SMA</button>
      <button onClick={() => addIndicator('rsi')}>Add RSI</button>

      <ChartComponent
        bars={bars}
        indicators={indicators}
      />
    </>
  );
}
```

#### Overlay vs Separate Pane

- **Overlay Indicators**: SMA, EMA, Bollinger Bands, VWAP (shown on main chart)
- **Separate Pane**: RSI, MACD, Stochastic (shown below main chart)

See [Creating Indicators](./creating-indicators.md) for details on building custom indicators.

### Volume Display

Volume is automatically displayed as a histogram at the bottom of the main chart.

#### Color Coding

- **Green**: Volume for up bars (close > open)
- **Red**: Volume for down bars (close < open)
- **Semi-transparent**: 50% opacity for better visibility

Volume sits in its own pane below price, sized to a small fraction (~14%) of the
chart height by default so price action dominates.

### Session shading + day separators

Pass `sessions` to shade trading sessions (pre-market / RTH / after-hours) behind the
candles and draw a thin separator at each day boundary. `true` uses the US-equity preset
(ET; pre-market + after-hours dimmed, RTH clear); pass a `SessionsConfig` for custom
sessions, timezone, or colors; omit/`false` to disable.

```tsx
import { ChartComponent, US_EQUITY_PRESET, type SessionsConfig } from '@adrienhobbs/candlekit';

<ChartComponent bars={bars} sessions />            {/* US-equity preset */}

const custom: SessionsConfig = {                    // or fully custom
  timeZone: 'America/New_York',
  sessions: [
    { name: 'pre',  startMinutes: 240, endMinutes: 570, color: 'rgba(128,128,128,0.10)' },
    { name: 'rth',  startMinutes: 570, endMinutes: 960, color: 'transparent' },
    { name: 'post', startMinutes: 960, endMinutes: 1200, color: 'rgba(128,128,128,0.10)' },
  ],
  separatorColor: 'rgba(128,128,128,0.25)',
  separatorWidthPx: 1,
};
<ChartComponent bars={bars} sessions={custom} />
```

- `startMinutes`/`endMinutes` are minutes-from-midnight **in `timeZone`** (09:30 = 570);
  inclusive start, exclusive end. DST is handled automatically.
- `color: 'transparent'` leaves a session unshaded (e.g. RTH). Omit `separatorColor` to hide day separators.
- Drawn by a canvas `ISeriesPrimitive`: shading sits behind the candles, separators in front.
  Memoize a config object so the live primitive isn't re-applied each render.

### Crosshair OHLC legend

`showOhlcLegend` shows a top-left legend that follows the crosshair: O/H/L/C, change (abs + %),
volume, and each active indicator's value at the hovered bar. When the cursor is idle it follows
the **selected bar** (so click / arrow-key navigation updates it), or the last bar if none is selected. Style it
yourself with `renderOhlcLegend`.

```tsx
<ChartComponent bars={bars} indicators={indicators} showOhlcLegend />

// or a custom legend (full control over markup/styling):
<ChartComponent
  bars={bars}
  renderOhlcLegend={(d) => (
    <div className="my-legend">
      {d.close} ({d.changePct.toFixed(2)}%) · vol {d.volume}
      {d.indicators.map((i) => <span key={i.label} style={{ color: i.color }}>{i.label} {i.value}</span>)}
    </div>
  )}
/>
```

`OhlcLegendData` = `{ time, open, high, low, close, volume, changeAbs, changePct, indicators: { label, color, value }[] }`.

## Event Callbacks

### Data Loading

#### onLoadMoreData

Triggered when user scrolls to view older data.

```typescript
onLoadMoreData?: (oldestTimestamp: number) => void
```

**Parameters:**
- `oldestTimestamp`: Unix timestamp (ms) of the oldest bar currently displayed

**Example:**
```typescript
const handleLoadMore = async (oldestTimestamp: number) => {
  const olderBars = await api.fetchBarsOlderThan(oldestTimestamp);
  setBars(prev => [...olderBars, ...prev]);
};
```

### Bar Interaction

#### onBarClick

Triggered when user clicks a bar or deselects the current selection.

```typescript
onBarClick?: (bar: OHLCVBar | null) => void
```

**Parameters:**
- `bar`: The selected bar, or `null` if deselecting

**Example:**
```typescript
const handleBarClick = (bar: OHLCVBar | null) => {
  if (bar) {
    setSelectedBar(bar);
    showBarDetails(bar);
  } else {
    setSelectedBar(null);
    hideBarDetails();
  }
};
```

#### onBarUpdate

Triggered when the current (most recent) bar is updated.

```typescript
onBarUpdate?: (updatedBar: OHLCVBar) => void
```

**Use Case**: Real-time price updates within the current time period.

#### onNewBar

Triggered when a new bar is added to the chart.

```typescript
onNewBar?: (newBar: OHLCVBar) => void
```

**Use Case**: When time period closes and new bar begins.

### Line Management

#### onDeleteLine

Triggered when user clicks the delete button on a price line.

```typescript
onDeleteLine?: (lineId: string) => void
```

**Example:**
```typescript
const handleDeleteLine = (lineId: string) => {
  setLines(prev => prev.filter(line => line.id !== lineId));
};
```

#### onAddLine

Triggered when user adds a line from the context menu.

```typescript
onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit', price: number) => void
```

**Example:**
```typescript
const handleAddLine = (type, price) => {
  const newLine = createLine(type, price);
  setLines(prev => [...prev, newLine]);
};
```

#### onLineMove

Triggered when the user drags a price line to a new price (fires on release). See
[Interactive Lines](#interactive-lines).

```typescript
onLineMove?: (lineId: string, price: number) => void
```

**Example:**
```typescript
const handleLineMove = (id: string, price: number) => {
  setLines(prev => prev.map(l => (l.id === id ? { ...l, price } : l)));
};
```

#### onLineChange

Triggered when the user double-clicks a line and saves the built-in edit dialog. See
[Interactive Lines](#interactive-lines).

```typescript
onLineChange?: (line: ChartLine) => void
```

**Example:**
```typescript
const handleLineChange = (line: ChartLine) => {
  setLines(prev => prev.map(l => (l.id === line.id ? line : l)));
};
```

## Chart Interactions

### Mouse Controls

| Action | Result |
|--------|--------|
| **Click** | Select bar |
| **Click selected bar** | Deselect |
| **Drag** | Pan chart horizontally |
| **Scroll wheel** | Zoom in/out |
| **Right-click** | Open context menu |
| **Click delete button** | Remove price line |
| **Drag a price line** | Reprice it (`onLineMove`) |
| **Double-click a price line** | Edit it in a dialog (`onLineChange`) |

### Touch Controls

| Action | Result |
|--------|--------|
| **Tap** | Select bar |
| **Drag** | Pan chart |
| **Pinch** | Zoom in/out |

### Drag vs Click Detection

The component distinguishes between clicks and drags:
- Movement < 5px = Click (selects bar)
- Movement ≥ 5px = Drag (pans chart)

## Styling

### Theme

ChartComponent uses a dark theme by default:

- Background: `#0f172a` (slate-900)
- Text: `#94a3b8` (slate-400)
- Grid lines: `#1e293b` (slate-800)
- Borders: `#334155` (slate-700)

### Candlestick Colors

- Up candles: `#10b981` (green)
- Down candles: `#ef4444` (red)

### Spotlight Overlay

Selected bar is highlighted with:
- Background: `rgba(59, 130, 246, 0.15)` (blue, 15% opacity)
- Border: `rgba(59, 130, 246, 0.4)` (blue, 40% opacity)

### Customizing Appearance

To customize the chart appearance, you can:

1. **Modify the component directly**: Edit color values in `ChartComponent.tsx`
2. **Create a themed wrapper**: Wrap ChartComponent with your own styling logic
3. **Use CSS classes**: Add custom classes to indicator settings

## Data Management

ChartComponent is a pure presentation component that doesn't manage data internally. You're responsible for fetching, storing, and updating the `bars` prop. This section covers patterns and tools to make data management easier.

### Understanding the Data Flow

```
Data Source → Your State Management → ChartComponent
(API/WS)         (useBarsData)           (Display)
```

ChartComponent only cares about the `bars` array you pass it. The rest is up to you.

### The useBarsData Hook

We provide a `useBarsData` hook that handles common data management tasks:

```typescript
import { useBarsData } from './hooks/useBarsData';
import { AlpacaBarAdapter } from './adapters/alpaca';

const adapter = new AlpacaBarAdapter({
  apiKey: import.meta.env.VITE_ALPACA_API_KEY,
  secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
});

const {
  bars,              // Current bars array
  loading,           // Loading state
  error,             // Error state
  connected,         // WebSocket connection status
  setBars,           // Replace all bars
  appendBar,         // Add bar to end
  updateLastBar,     // Update current bar
  updateCurrentBar,  // Update with trade data
  prependBars,       // Add bars to beginning
  fetchHistorical,   // Fetch historical data
  subscribe,         // Subscribe to real-time updates
  unsubscribe,       // Unsubscribe from updates
} = useBarsData({
  adapter,
  symbol: 'AAPL',
  timeframe: '5Min',
  autoFetch: true,
  autoSubscribe: true,
  limit: 500,
});
```

### Data Management Recipes

#### Recipe 1: REST API Only (No Real-Time)

Perfect for historical analysis or when you don't need live updates:

```typescript
import { useState } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function HistoricalChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBars = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bars?symbol=AAPL&limit=500');
      const data = await response.json();
      setBars(data);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreBars = async (oldestTimestamp: number) => {
    const response = await fetch(
      `/api/bars?symbol=AAPL&before=${oldestTimestamp}&limit=100`
    );
    const olderBars = await response.json();
    setBars(prev => [...olderBars, ...prev]);
  };

  return (
    <ChartComponent
      bars={bars}
      onLoadMoreData={loadMoreBars}
    />
  );
}
```

#### Recipe 2: WebSocket Only (Real-Time Stream)

For live trading data with no historical context:

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function LiveChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    const ws = new WebSocket('wss://api.example.com/bars');

    ws.onmessage = (event) => {
      const bar: OHLCVBar = JSON.parse(event.data);
      setBars(prev => [...prev, bar]);
    };

    return () => ws.close();
  }, []);

  return <ChartComponent bars={bars} />;
}
```

#### Recipe 3: REST + WebSocket (Best of Both)

Load historical data, then stream real-time updates:

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';
import { updateCurrentBar } from './utils/barUtils';

function HybridChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    fetchHistorical();
    subscribeRealtime();
  }, []);

  const fetchHistorical = async () => {
    const response = await fetch('/api/bars?limit=500');
    const data = await response.json();
    setBars(data);
  };

  const subscribeRealtime = () => {
    const ws = new WebSocket('wss://api.example.com/trades');

    ws.onmessage = (event) => {
      const trade = JSON.parse(event.data);
      setBars(prev => updateCurrentBar(prev, trade.price, trade.size));
    };

    return () => ws.close();
  };

  return <ChartComponent bars={bars} />;
}
```

#### Recipe 4: Polling Strategy

When WebSocket isn't available, poll the API:

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function PollingChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    const fetchLatest = async () => {
      const response = await fetch('/api/bars/latest');
      const newBars = await response.json();
      setBars(prev => [...prev, ...newBars]);
    };

    const interval = setInterval(fetchLatest, 5000);
    fetchLatest();

    return () => clearInterval(interval);
  }, []);

  return <ChartComponent bars={bars} />;
}
```

#### Recipe 5: Using useBarsData with Alpaca

Complete example with real market data:

```typescript
import { useBarsData } from './hooks/useBarsData';
import { AlpacaBarAdapter } from './adapters/alpaca';
import ChartComponent from './components/ChartComponent';

function AlpacaChart() {
  const adapter = new AlpacaBarAdapter({
    apiKey: import.meta.env.VITE_ALPACA_API_KEY,
    secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
  });

  const {
    bars,
    loading,
    error,
    connected,
    fetchHistorical,
  } = useBarsData({
    adapter,
    symbol: 'AAPL',
    timeframe: '5Min',
    autoFetch: true,
    autoSubscribe: true,
  });

  const handleLoadMore = async (oldestTimestamp: number) => {
    await fetchHistorical({
      before: oldestTimestamp,
      limit: 100,
    });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <div className="status">
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      <ChartComponent
        bars={bars}
        onLoadMoreData={handleLoadMore}
      />
    </div>
  );
}
```

### Data Utilities

We provide utility functions for common bar operations:

```typescript
import {
  validateBar,
  normalizeTimestamp,
  sortBars,
  deduplicateBars,
  mergeBars,
  updateCurrentBar,
  appendBar,
  prependBars,
} from './utils/barUtils';

const newBars = validateAndNormalizeBars(rawData);

const sorted = sortBars(bars);

const unique = deduplicateBars(bars);

const combined = mergeBars(existingBars, newBars);

const updated = updateCurrentBar(bars, tradePrice, tradeVolume);
```

### Creating Custom Adapters

You can create adapters for any data provider:

```typescript
import { BarDataAdapter, HistoricalDataParams, RealtimeHandlers } from './adapters/types';

class MyCustomAdapter implements BarDataAdapter {
  async fetchHistoricalBars(params: HistoricalDataParams) {
    const response = await fetch(`/api/bars?symbol=${params.symbol}`);
    const data = await response.json();

    return data.map(bar => ({
      timestamp: bar.time * 1000,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));
  }

  subscribeRealtime(symbol: string, handlers: RealtimeHandlers) {
    const ws = new WebSocket(`wss://my-api.com/${symbol}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handlers.onBar?.(data);
    };

    ws.onerror = () => handlers.onError?.(new Error('WebSocket error'));

    return {
      unsubscribe: () => ws.close(),
    };
  }
}
```

### Best Practices

1. **Always validate data**: Use `validateBar()` before adding to state
2. **Handle duplicates**: Use `deduplicateBars()` to prevent duplicate timestamps
3. **Sort chronologically**: Always keep bars sorted by timestamp
4. **Normalize timestamps**: Convert seconds to milliseconds with `normalizeTimestamp()`
5. **Error handling**: Always catch and display errors to users
6. **Loading states**: Show loading indicators during data fetches
7. **Cleanup**: Unsubscribe from WebSockets on component unmount
8. **Throttle updates**: Don't update more than once per second for performance

## Integration Examples

### With REST API

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';

function RESTChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const response = await fetch('/api/bars?limit=500');
      const data = await response.json();
      setBars(data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async (oldestTimestamp: number) => {
    const response = await fetch(
      `/api/bars?before=${oldestTimestamp}&limit=100`
    );
    const olderBars = await response.json();
    setBars(prev => [...olderBars, ...prev]);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <ChartComponent
      bars={bars}
      onLoadMoreData={handleLoadMore}
    />
  );
}
```

### With WebSocket

```typescript
import { useState, useEffect, useRef } from 'react';
import ChartComponent from './components/ChartComponent';

function WebSocketChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    wsRef.current = new WebSocket('wss://api.example.com/trades');

    wsRef.current.onmessage = (event) => {
      const trade = JSON.parse(event.data);
      updateCurrentBar(trade);
    };

    // Load initial data
    fetchInitialData();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const updateCurrentBar = (trade: any) => {
    setBars(prev => {
      if (prev.length === 0) return prev;

      const updated = [...prev];
      const currentBar = { ...updated[updated.length - 1] };

      // Update current bar with new trade
      currentBar.close = trade.price;
      currentBar.high = Math.max(currentBar.high, trade.price);
      currentBar.low = Math.min(currentBar.low, trade.price);
      currentBar.volume += trade.size;

      updated[updated.length - 1] = currentBar;
      return updated;
    });
  };

  return <ChartComponent bars={bars} />;
}
```

### With Database Query

```typescript
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import ChartComponent from './components/ChartComponent';

function DatabaseChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    loadBars();
  }, []);

  const loadBars = async () => {
    const { data } = await supabase
      .from('ohlcv_bars')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(500);

    if (data) {
      setBars(data);
    }
  };

  const handleLoadMore = async (oldestTimestamp: number) => {
    const { data } = await supabase
      .from('ohlcv_bars')
      .select('*')
      .lt('timestamp', oldestTimestamp)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (data) {
      setBars(prev => [...data.reverse(), ...prev]);
    }
  };

  return (
    <ChartComponent
      bars={bars}
      onLoadMoreData={handleLoadMore}
    />
  );
}
```

### With useChartAPI Hook

The `useChartAPI` hook provides state management for lines and indicators with optional persistence.

```typescript
import { useState } from 'react';
import ChartComponent from './components/ChartComponent';
import { useChartAPI } from './hooks/useChartAPI';

function ManagedChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  const {
    lines,
    indicators,
    addLineByType,
    removeLine,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings,
  } = useChartAPI();

  return (
    <div>
      <div className="controls">
        <button onClick={() => addIndicator('sma')}>Add SMA</button>
        <button onClick={() => addIndicator('rsi')}>Add RSI</button>
        <button onClick={() => addLineByType('entry', 100)}>
          Add Entry @ 100
        </button>
      </div>

      <ChartComponent
        bars={bars}
        indicators={indicators}
        lines={lines}
        onAddLine={addLineByType}
        onDeleteLine={removeLine}
      />
    </div>
  );
}
```

## Persistence Options

The indicator system supports multiple persistence strategies. ChartComponent itself is stateless, but you can persist indicator configurations using the `useChartAPI` hook with a persistence adapter.

### No Persistence (Default)

State is kept in memory only and lost on page refresh:

```typescript
const { indicators, addIndicator } = useChartAPI();
```

### localStorage

Persist to browser's localStorage:

```typescript
import { createPersistenceAdapter } from './indicators/core/persistence';

const persistenceAdapter = createPersistenceAdapter('localStorage');

const { indicators, addIndicator } = useChartAPI({ persistenceAdapter });
```

### Supabase

Persist to Supabase database:

```typescript
import { createPersistenceAdapter } from './indicators/core/persistence';

const persistenceAdapter = createPersistenceAdapter('supabase', {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-anon-key',
});

const { indicators, addIndicator } = useChartAPI({ persistenceAdapter });
```

### Custom Adapter

Implement your own persistence strategy:

```typescript
import { PersistenceAdapter } from './indicators/core/persistence';

const customAdapter: PersistenceAdapter = {
  async saveIndicators(indicators) {
    await myDatabase.save('indicators', indicators);
  },

  async loadIndicators() {
    const data = await myDatabase.load('indicators');
    return data || [];
  },
};

const { indicators, addIndicator } = useChartAPI({
  persistenceAdapter: customAdapter,
});
```

## Performance

### Data Handling

ChartComponent is optimized for handling large datasets:

- **Automatic deduplication**: Removes duplicate timestamps
- **Efficient updates**: Uses `update()` for single bar changes vs `setData()` for full refresh
- **Sorted data**: Maintains chronological order

### Best Practices

1. **Limit initial data**: Load 200-500 bars initially
2. **Paginate historical data**: Load more as needed via infinite scroll
3. **Throttle real-time updates**: Update at most once per second
4. **Memoize expensive calculations**: Use `useMemo` for derived data
5. **Avoid unnecessary re-renders**: Memoize callback functions with `useCallback`

### Large Datasets

For datasets > 10,000 bars:

- Load data incrementally
- Consider data sampling for very old data
- Use server-side aggregation for different timeframes
- Implement data virtualization if needed

## Troubleshooting

### Bars Not Displaying

**Problem**: Chart is empty or bars don't appear

**Solutions**:
- Verify timestamps are in milliseconds (not seconds)
- Check bars are sorted by timestamp (ascending)
- Ensure all required fields are present (timestamp, open, high, low, close, volume)
- Verify data types are numbers (not strings)
- Check browser console for errors

```typescript
// ❌ Wrong
bars: [{ timestamp: "1700000000", open: "100", ... }]

// ✅ Correct
bars: [{ timestamp: 1700000000000, open: 100, ... }]
```

### Timestamps in Wrong Format

**Problem**: Chart shows wrong dates or timezone issues

**Solution**: Always use Unix timestamps in milliseconds

```typescript
// Convert seconds to milliseconds
const bars = apiData.map(bar => ({
  ...bar,
  timestamp: bar.timestamp * 1000,
}));

// Convert ISO string to timestamp
const timestamp = new Date(isoString).getTime();
```

### Duplicate Bars

**Problem**: Multiple bars at the same timestamp

**Solution**: Component handles deduplication automatically, but you should prevent duplicates in your data source:

```typescript
const uniqueBars = bars.reduce((acc, bar) => {
  if (!acc.find(b => b.timestamp === bar.timestamp)) {
    acc.push(bar);
  }
  return acc;
}, [] as OHLCVBar[]);
```

### Indicators Not Updating

**Problem**: Indicators don't recalculate when data changes

**Solutions**:
- Ensure indicator calculator cache is invalidated
- Verify indicator settings schema is valid
- Check indicator definition is registered

```typescript
import { indicatorCalculator } from './indicators/core/calculator';

// Manually invalidate cache
indicatorCalculator.invalidateCache(indicatorId);
```

### Lines Not Appearing

**Problem**: Price lines don't show on chart

**Solutions**:
- Verify line price is within visible range
- Check line color isn't same as background
- Ensure `lines` prop is passed to component
- Verify line IDs are unique

### Bar Selection Not Working

**Problem**: Clicking bars doesn't select them

**Solutions**:
- Check `enableBarSelection={true}` is set
- Verify `onBarClick` callback is provided
- Ensure bars have valid timestamps
- Check for JavaScript errors in console

### Loading Indicator Stuck

**Problem**: "Loading more data..." never disappears

**Solution**: Ensure you're actually adding new bars with older timestamps:

```typescript
const handleLoadMore = async (oldestTimestamp: number) => {
  const olderBars = await fetchData();

  // Must prepend bars OLDER than oldestTimestamp
  setBars(prev => [...olderBars, ...prev]);
};
```

## TypeScript Types

### OHLCVBar

```typescript
interface OHLCVBar {
  timestamp: number;      // Unix timestamp in milliseconds
  open: number;          // Opening price
  high: number;          // Highest price
  low: number;           // Lowest price
  close: number;         // Closing price
  volume: number;        // Trading volume
  trade_count?: number;  // Optional: number of trades
  vwap?: number;        // Optional: volume-weighted average price
}
```

### ChartLine

```typescript
interface ChartLine {
  id: string;                                    // Unique identifier
  price: number;                                 // Price level
  color: string;                                 // Hex color
  lineWidth?: number;                            // Line thickness (default: 2)
  lineStyle?: 'solid' | 'dashed' | 'dotted';    // Line style (default: 'solid')
  title?: string;                                // Label text
  type?: 'entry' | 'stopLoss' | 'takeProfit';   // Line type
  deletable?: boolean;                           // Show delete button (default: true)
}
```

### ChartComponentProps

```typescript
interface ChartComponentProps {
  bars: OHLCVBar[];
  onLoadMoreData?: (oldestTimestamp: number) => void;
  indicators?: IndicatorInstance[];
  lines?: ChartLine[];
  onBarUpdate?: (updatedBar: OHLCVBar) => void;
  onNewBar?: (newBar: OHLCVBar) => void;
  onDeleteLine?: (lineId: string) => void;
  onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit', price: number) => void;
  enableBarSelection?: boolean;
  onBarClick?: (bar: OHLCVBar | null) => void;
}
```

## Related Documentation

- [Creating Indicators](./creating-indicators.md) - Build custom technical indicators
- [Architecture](./architecture.md) - System architecture and design decisions
- [API Reference](./api-reference.md) - Complete API documentation
- [Examples](./examples.md) - More example implementations
- [Lightweight Charts](../learnings/lightweight-charts.md) - Learn about the underlying chart library

---

**Need help?** Check the [troubleshooting section](#troubleshooting) or review the [examples](./examples.md) for common patterns.
