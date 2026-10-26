# ChartComponent Usage Guide

A comprehensive guide to using the ChartComponent in your trading application.

> **[Live demo](https://adrienhobbs.github.io/candlestick-chart/)** — drag/edit lines, hover a
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
- [Lines and Indicators State (useChartAPI)](#lines-and-indicators-state-usechartapi)
- [Persistence Options](#persistence-options)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [TypeScript Types](#typescript-types)
- [Related Documentation](#related-documentation)

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

```bash
npm install @adrienhobbs/candlekit lightweight-charts react react-dom
```

`lightweight-charts` (`^5.1.0`), `react` and `react-dom` (`>=18`) are peer dependencies.
Import the components, hooks and types as named exports, and load the stylesheet once:

```typescript
import { ChartComponent, useChartAPI, type OHLCVBar, type ChartLine } from '@adrienhobbs/candlekit';
import '@adrienhobbs/candlekit/styles.css';
```

The package also loads under Node (SSR, unit tests): the indicator math library is bundled,
so importing it does not pull in a browser-only dependency. The chart itself still needs a
DOM to render.

## Basic Usage

### Minimal Example

The simplest use case requires only the `bars` prop:

```typescript
import { useState } from 'react';
import { ChartComponent, type OHLCVBar } from '@adrienhobbs/candlekit';
import '@adrienhobbs/candlekit/styles.css';

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
import { ChartComponent, useChartAPI, type OHLCVBar } from '@adrienhobbs/candlekit';

function TradingChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);

  const {
    lines,
    indicators,
    addLineByType,
    removeLine,
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
// Correct: milliseconds
{ timestamp: 1700000000000 }

// Wrong: seconds
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

- The component sorts bars by timestamp and keeps the first bar of any duplicate
  timestamp, but sending sorted, unique bars avoids surprises in your own code
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
| `onLoadMoreData` | `(oldestTimestamp: number) => void \| Promise<unknown>` | - | Called when the user scrolls to within 5 bars of the oldest bar. Return a promise so the chart knows when the load ends. See [Infinite Scroll](#infinite-scroll-load-more-data) |
| `indicators` | `IndicatorInstance[]` | `[]` | Indicator instances to display (usually from `useChartAPI`) |
| `lines` | `ChartLine[]` | `[]` | Price lines to draw. See [Price Lines](#price-lines) |
| `onDeleteLine` | `(lineId: string) => void` | - | Shows a delete button on each deletable line and fires when it is clicked |
| `onAddLine` | `(type, price) => void` | - | Built-in menu: add a typed line at the price. `type` is `'entry' \| 'stopLoss' \| 'takeProfit' \| 'support' \| 'resistance'` (see [Context Menu](#context-menu)) |
| `onClearAllLines` | `() => void` | - | Built-in menu: clear all lines |
| `onLineMove` | `(lineId: string, price: number) => void` | - | Drag a line to reprice it; fires on release (see [Interactive Lines](#interactive-lines)) |
| `onLineChange` | `(line: ChartLine) => void` | - | Double-click a line to edit it in the built-in dialog; fires on save (see [Interactive Lines](#interactive-lines)) |
| `contextMenuItems` | `({ price }) => ContextMenuItem[]` | - | Replace the built-in menu with your own items (see [Context Menu](#context-menu)) |
| `enableBarSelection` | `boolean` | `true` | Enable/disable bar selection |
| `onBarClick` | `(bar: OHLCVBar \| null) => void` | - | Fired when a bar is clicked, or with `null` when the selected bar is clicked again (uncontrolled mode) |
| `selectedBarTime` | `number \| null` | uncontrolled | Externally control the selected bar (spotlight) by ms timestamp — lets a parent move the selection (e.g. arrow keys). See [Bar Selection](#bar-selection) |
| `trades` | `ChartTrade[]` | `[]` | Trades to mark on the chart (entry/exit markers, colored by win/loss). See [Trade Markers & Popup](#trade-markers--popup) |
| `markers` | `ChartMarker[]` | `[]` | Free-standing markers (circle/square/arrow + text), snapped to bars, optionally at a price. See [Markers](#markers) |
| `signposts` | `ChartSignpost[]` | `[]` | Vertical lines with a label pill on the chart's top edge. See [Signposts and the event rail](#signposts-and-the-event-rail) |
| `railMarkers` | `ChartRailMarker[]` | `[]` | Marks on the event rail along the bottom of the price pane (shown only when non-empty). See [Signposts and the event rail](#signposts-and-the-event-rail) |
| `selectedTradeId` | `string \| null` | `null` | Emphasizes the matching trade's markers and adds `entry`/`exit` text labels |
| `focusTradeId` | `string \| null` | `null` | Scrolls/frames the matching trade into view. Re-frames only when the id changes or the bars its entry/exit land on change, so a re-created `trades` array, a live tick, or older bars loaded on scroll-back keep the user's view |
| `renderTradePopup` | `(trade: ChartTrade) => ReactNode` | - | Render a popup for the trade under the selected bar. See [Trade Markers & Popup](#trade-markers--popup) |
| `priceBands` | `PriceBand[]` | `[]` | Shaded horizontal price bands (e.g. an MFE↔MAE zone); time-bounded when `startTime` + `endTime` are set |
| `sessions` | `SessionsConfig \| boolean` | `false` | Session shading + day separators; `true` uses the US-equity preset. See [Session shading](#session-shading--day-separators) |
| `showOhlcLegend` | `boolean` | `false` | Crosshair OHLC legend. See [Crosshair OHLC legend](#crosshair-ohlc-legend) |
| `renderOhlcLegend` | `(data: OhlcLegendData) => ReactNode` | - | Custom renderer for the OHLC legend (replaces the built-in one) |
| `onHoverBar` | `(timeMs: number \| null) => void` | - | Fired with the hovered bar's time (ms) as the crosshair moves; `null` when the cursor leaves. See [Time-bounded overlays](#time-bounded-overlays-segments--boxes) |
| `timeZone` | `string` | viewer local | IANA timezone for axis ticks + crosshair labels |
| `height` | `number` | fill parent | Fixed chart height in px. Omit to fill the parent's height (tracked with a ResizeObserver); a parent with no definite height gets 600px |
| `theme` | `Partial<ChartTheme>` | slate dark | Chart canvas colors — background, grid, axes, candles, volume. See [Theming](./theming.md) |
| `volumeMode` | `'pane' \| 'overlay'` | `'pane'` | Volume in its own pane under the price pane, or as an overlay along the bottom of the price pane. See [Volume](#volume) |

Array props default to stable module-level empty arrays, so omitting one does not re-run
its effects on every render. Arrays you pass should be memoized for the same reason.

## Features

### Infinite Scroll (Load More Data)

The infinite scroll feature automatically triggers when users pan back to view older data.

#### How It Works

1. User scrolls/pans to the left edge of the chart
2. When the visible range comes within 5 bars of the oldest bar, `onLoadMoreData` is called
   with the oldest bar's timestamp
3. The component shows a "Loading more data..." indicator and makes no other call while the
   load is pending
4. Your callback fetches and prepends older bars
5. The chart applies the new bars and keeps the user's view

A load ends when bars older than the requested timestamp arrive, or when the promise your
callback returns settles (resolved or rejected). A callback that returns nothing gets 10
seconds. A load that added no older bars (the start of the available history, or a failed
request) is not repeated until the view leaves the left edge and comes back, so the chart
never re-requests on every scroll event. A bar appended on the right does not end a load.

The chart always calls the latest `onLoadMoreData`, so the callback can close over the
current symbol or timeframe.

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
- Handle errors gracefully
- Return (or `await` inside) the fetch's promise, so the indicator clears as soon as it ends
- Cache fetched data to avoid redundant API calls

### Bar Selection

Click any bar to select it and view detailed information.

#### Features

- Visual spotlight overlay on selected bar
- Marker above the selected bar
- Deselect by clicking the same bar again (uncontrolled mode)
- Callback provides full bar data
- Shown in the [OHLC legend](#crosshair-ohlc-legend) while the cursor is idle

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
  type?: 'entry' | 'stopLoss' | 'takeProfit' | 'mfe' | 'mae';
  deletable?: boolean;  // default true; set false to hide the delete button (read-only line)
  draggable?: boolean;  // default true; set false to make the line non-draggable (read-only line)
  editable?: boolean;   // default true; set false to disable double-click-to-edit (read-only line)
  startTime?: number;   // ms; with endTime, draws a time-bounded segment (see below)
  endTime?: number;
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

When `onDeleteLine` is wired, each line has a delete button (×) positioned on the right side of the chart. Click to remove the line. Set `deletable: false` on a line to hide its delete button — useful for derived/read-only lines (e.g. a trade overlay) that shouldn't be removed.

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
optional inline title at the segment's left end. Each end snaps down to the bar containing it
(a start before the first bar clamps to it; a span that ends before the first bar is dropped; a
span inside one bar extends to the next bar), so times recorded off the bar grid, or a 5-minute
trade on an hourly chart, still draw. Pair with `onHoverBar` to show a trade's overlays only while hovering its bars.

A bounded **box** also takes optional `topLabel` / `bottomLabel` strings, drawn inside the box at
its top / bottom edge — e.g. the favorable `+R` and adverse `−R` of an MFE↔MAE excursion — with
optional `topLabelColor` / `bottomLabelColor` (default: the box's border color).

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
  muted?: boolean;     // draw faded (outcome hue at reduced opacity)
  markerStyle?: 'arrows' | 'price'; // default 'arrows'
}
```

- **`markerStyle: 'price'`** — instead of the ▲/▼ arrows under/over the bars, draws a
  ▶ pointing at `entryPrice` on the entry bar and a ◀ pointing at `exitPrice` on the
  exit bar, so the mark shows where the fill was as well as when.

- **`muted`** — draws the trade's markers in its outcome color at reduced opacity,
  for a trade shown for context rather than reviewed (refused, counterfactual,
  co-fired). A non-hex theme color falls back to a neutral fade.
- **`selectedTradeId`** — the matching trade's markers are emphasized and labeled
  (`entry`/`exit` text).
- **`focusTradeId`** — scrolls/frames the matching trade into view (pairs with
  `selectedTradeId` to drive both selection and focus). It re-frames only when the id
  changes or the bars its entry/exit land on change, so new `trades` arrays, live ticks,
  and pages loaded on scroll-back don't yank the view.
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

### Markers

`markers` draws free-standing series markers for anything time-anchored that isn't a
trade's entry/exit — an excursion extreme, an order fill, a virtual exit, a signal.

```typescript
interface ChartMarker {
  id: string;
  time: number;        // ms — snapped DOWN to the bar at or before it; dropped if before the first bar
  price?: number;      // draw at this exact price (position defaults to 'atPriceMiddle')
  position?: 'aboveBar' | 'belowBar' | 'inBar' | 'atPriceTop' | 'atPriceBottom' | 'atPriceMiddle';
  shape?: 'circle' | 'square' | 'arrowUp' | 'arrowDown' | 'arrowRight' | 'arrowLeft'; // default 'circle'
  color: string;
  text?: string;
  size?: number;
  hollow?: boolean;    // outline only
}
```

`arrowRight` (▶) sits left of its bar pointing at the price and `arrowLeft` (◀) right
of it — an entry and an exit fill. They and `hollow` markers (e.g. the same event in a
counterfactual book) are drawn by candlekit's own primitive, not lightweight-charts'
series markers; their `text` is not drawn.

```tsx
const markers = useMemo<ChartMarker[]>(() => [
  { id: 'mfe', time: mfe.tsMs, price: mfe.price, color: '#10b981', text: 'MFE' },
  { id: 'fill', time: fill.atMs, price: fill.price, shape: 'square', color: '#a855f7' },
], [mfe, fill]);

<ChartComponent bars={bars} trades={trades} markers={markers} />
```

Markers merge with the trade markers and the selected-bar marker (all sorted by
time). Price-positioned markers need lightweight-charts **≥ 5.1**. Memoize the
array — a new identity re-sets every marker.

### Signposts and the event rail

Two places for annotations that would otherwise crowd the candles:

```typescript
interface ChartSignpost {     // signposts={...}
  id: string;
  time: number;               // ms, snapped down to a bar
  label: string;              // e.g. 'ENTRY 330.12'
  color: string;              // pill fill (hex gets a tinted line)
}

interface ChartRailMarker {   // railMarkers={...}
  id: string;
  time: number;               // ms, snapped down to a bar
  color: string;
  shape?: 'circle' | 'square' | 'triangleUp' | 'triangleDown' | 'diamond';
  hollow?: boolean;
  label?: string;             // 1–2 characters, drawn when there is room
}
```

- **Signposts** — a dashed vertical line at the bar with a label pill on the chart's
  top edge. Pills that would overlap stack into a second (then third) row. With the
  [OHLC legend](#crosshair-ohlc-legend) on, pills that would sit under it drop to just
  below it instead.
- **Event rail** — a 16 px strip along the bottom of the price pane, shown only when
  `railMarkers` is non-empty, for events that aren't a price (an excursion extreme's
  bar, a timer that would have fired). Marks sharing a bar sit side by side. The
  strip lives inside the default bottom price-scale margin, so candles don't overlap
  it unless the price scale is dragged.

Memoize both arrays.

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

Display technical indicators on the chart. Overlay indicators draw on the price pane; the
others get their own pane below the chart.

#### Adding Indicators

```typescript
import { ChartComponent, useChartAPI } from '@adrienhobbs/candlekit';

function MyChart({ bars }) {
  const { indicators, addIndicator } = useChartAPI();

  return (
    <>
      <button onClick={() => addIndicator('sma')}>Add SMA</button>
      <button onClick={() => addIndicator('rsi', { period: 21 })}>Add RSI</button>

      <ChartComponent bars={bars} indicators={indicators} />
    </>
  );
}
```

`addIndicator(definitionId, settings?)` takes a registered indicator id; settings not
given use the definition's defaults. The `IndicatorBrowser` and `SettingsDialog`
components provide a ready-made picker and settings editor.

#### Overlay vs Separate Pane

- **Overlay** (price pane): `sma`, `ema`, `wma`, `bollinger`, `keltner`, `donchian`,
  `ichimoku`, `vwap`, `psar`, `supertrend`, `swingpoints`
- **Separate pane**: `rsi`, `macd`, `stochastic`, `stochrsi`, `adx`, `atr`, `cci`,
  `mfi`, `obv`, `roc`, `forceindex`, `williamsr`

See [Indicators](./indicators.md) for every built-in and its settings (including Swing
Points' `plotAt: 'pivot' | 'confirmation'`), and [Creating Indicators](./creating-indicators.md)
to build your own. To keep a user's indicators across reloads, see
[Persistence Options](#persistence-options).

### Volume

Volume is always drawn, as a histogram. Bars are colored with the theme's `volumeUpColor`
(close >= open) or `volumeDownColor` (close < open); the defaults are the candle colors at
50% opacity.

`volumeMode` picks where it goes:

- **`'pane'`** (default): its own pane below price, sized to about 14% of the chart height
  (at least 48 px) so price action dominates. The pane can be resized by dragging its
  separator, and its last value shows on its own axis.
- **`'overlay'`**: along the bottom of the price pane, on a separate hidden scale, rising
  to about 20% of the pane's height. Candles can draw over the bars, as on most trading
  platforms. When the event rail shows, the bars sit just above it. No value label is
  added to the price axis; the OHLC legend still shows the hovered bar's volume.

```tsx
<ChartComponent bars={bars} volumeMode="overlay" />
```

Switching `volumeMode` on a live chart moves the series without re-creating the chart.
Separate-pane indicators move up to fill the volume pane's slot in overlay mode.

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

Most callbacks are covered with their feature above. Signatures, as declared on
`ChartComponent`:

```typescript
onLoadMoreData?: (oldestTimestamp: number) => void | Promise<unknown>; // ms timestamp of the oldest bar
onBarClick?: (bar: OHLCVBar | null) => void;          // null = deselected (uncontrolled mode)
onHoverBar?: (timeMs: number | null) => void;         // null = cursor left the bars
onDeleteLine?: (lineId: string) => void;
onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance', price: number) => void;
onClearAllLines?: () => void;
onLineMove?: (lineId: string, price: number) => void; // fires on drag release
onLineChange?: (line: ChartLine) => void;             // fires on dialog save
```

There is no per-tick callback: the chart is driven entirely by the `bars` prop. To stream
live data, update `bars` (see [Data Management](#data-management)).

## Chart Interactions

### Mouse Controls

| Action | Result |
|--------|--------|
| **Click** | Select bar |
| **Click selected bar** | Deselect (uncontrolled mode) |
| **Drag** | Pan chart horizontally |
| **Scroll wheel** | Zoom in/out |
| **Right-click** | Open context menu (when a menu handler is wired) |
| **Click delete button** | Remove price line (`onDeleteLine`) |
| **Drag a price line** | Reprice it (`onLineMove`) |
| **Double-click a price line** | Edit it in a dialog (`onLineChange`) |

### Touch Controls

| Action | Result |
|--------|--------|
| **Tap** | Select bar |
| **Drag** | Pan chart |
| **Pinch** | Zoom in/out |

### Drag vs Click Detection

Pointer movement of more than 5px is treated as a drag (pans the chart, or moves a line);
less is a click.

### Keyboard and dialogs

The chart adds no keyboard shortcuts of its own; use `selectedBarTime` to drive selection
from the keyboard (see [Controlled Selection](#controlled-selection-selectedbartime)).

Escape closes only the innermost open candlekit dialog (`IndicatorBrowser`,
`SettingsDialog`, `LineSettingsDialog`). The key is consumed in the capture phase, so a host
modal that also closes on Escape stays open underneath.

## Styling

The chart canvas is themed through the `theme` prop; the dialogs and context menu read
`--ck-*` CSS variables. Both are covered in **[Theming](./theming.md)**.

Default canvas theme (`DEFAULT_CHART_THEME`, slate dark):

| Key | Default |
|-----|---------|
| `background` | `#0f172a` |
| `textColor` | `#94a3b8` |
| `gridColor` | `#1e293b` |
| `axisBorderColor` | `#334155` |
| `crosshairColor` | `#475569` |
| `paneSeparatorColor` | `#1e293b` |
| `upColor` / `downColor` | `#10b981` / `#ef4444` |
| `volumeUpColor` / `volumeDownColor` | `#10b98180` / `#ef444480` |

The selected-bar spotlight is a fixed blue overlay (`rgba(59, 130, 246, 0.15)` fill,
`rgba(59, 130, 246, 0.4)` edges) and is not part of `ChartTheme`.

## Data Management

ChartComponent does not fetch data; it renders whatever `bars` you pass. For fetching and
streaming, candlekit exports the `useBarsData` hook, which pairs with a `BarDataAdapter`
(`AlpacaBarAdapter`, `MockAdapter`, or your own) and returns `bars` plus loading/error state
and helpers such as `fetchHistorical` and `prependBars`. Bar utilities (`validateBar`,
`sortBars`, `deduplicateBars`, `mergeBars`, `updateCurrentBar`, ...) are exported from the
package root. See **[Data Management](./data-management.md)** for the hook API, adapters,
and integration recipes.

## Lines and Indicators State (useChartAPI)

`useChartAPI` holds `lines` and `indicators` state for you and returns helpers that match
ChartComponent's callbacks:

```typescript
import { useState } from 'react';
import { ChartComponent, useChartAPI, type OHLCVBar } from '@adrienhobbs/candlekit';

function ManagedChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  const {
    lines,
    indicators,
    addLineByType,   // (type, price) => void — matches onAddLine
    removeLine,      // (id) => void — matches onDeleteLine
    updateLine,      // (id, price) => void — matches onLineMove
    clearAllLines,   // () => void — matches onClearAllLines
    addIndicator,    // (definitionId, settings?) => IndicatorInstance
    removeIndicator,
    updateIndicatorSettings,
  } = useChartAPI();

  return (
    <ChartComponent
      bars={bars}
      indicators={indicators}
      lines={lines}
      onAddLine={addLineByType}
      onDeleteLine={removeLine}
      onLineMove={updateLine}
      onClearAllLines={clearAllLines}
    />
  );
}
```

It also returns `isLoadingIndicators`, `addLine(id, price, options?)`, and the typed
helpers `addEntryLine`, `addStopLoss`, `addTakeProfit`, `addSupportLine` and
`addResistanceLine`. It has no helper for `onLineChange` (a full line edit); if you need
the edit dialog, keep `lines` in your own state.

## Persistence Options

Only indicators are persisted; lines are always in memory. Pass a `persistenceAdapter` to
`useChartAPI`: it loads the saved indicators on mount and saves the whole set whenever it
changes.

Create the adapter once (at module scope or in `useMemo`). The hook reloads whenever the
adapter's identity changes, so an adapter created inline on every render keeps reloading.

### No Persistence (Default)

Without an adapter nothing is loaded or saved; indicators are lost on reload. This is the
same as passing `createPersistenceAdapter('noop')`.

```typescript
const { indicators, addIndicator } = useChartAPI();
```

### localStorage

```typescript
import { createPersistenceAdapter, useChartAPI } from '@adrienhobbs/candlekit';

const persistenceAdapter = createPersistenceAdapter('localStorage');

function MyChart() {
  const { indicators, addIndicator } = useChartAPI({ persistenceAdapter });
  // ...
}
```

The default key is `chart_indicators` (`DEFAULT_INDICATORS_STORAGE_KEY`). Charts that share
a key share one indicator set; give each chart that should keep its own set its own key:

```typescript
const priceChartAdapter = createPersistenceAdapter('localStorage', { key: 'indicators:price' });
const equityChartAdapter = createPersistenceAdapter('localStorage', { key: 'indicators:equity' });
```

### Custom Adapter

Implement `PersistenceAdapter` to store indicators anywhere else (your API, IndexedDB, a
database). All three methods are required:

```typescript
import type { PersistenceAdapter } from '@adrienhobbs/candlekit';

const customAdapter: PersistenceAdapter = {
  async saveIndicators(indicators) {
    await myApi.save('indicators', indicators);
  },
  async loadIndicators() {
    return (await myApi.load('indicators')) ?? [];
  },
  async deleteIndicator(id) {
    await myApi.remove('indicators', id);
  },
};

const { indicators, addIndicator } = useChartAPI({ persistenceAdapter: customAdapter });
```

`useChartAPI` only calls `loadIndicators` and `saveIndicators`; `deleteIndicator` is part
of the interface for direct use.

## Performance

### How bars are applied

On each `bars` change the chart sorts the bars and drops duplicate timestamps (keeping the
first), then compares them with the previous set:

- only the last bar changed (a forming bar ticking): a single `update()`, which keeps the view;
- anything else (first load, a prepended page, a new symbol, a different length): a full `setData()`;
- nothing changed: no work.

Replacing `bars` with a different series (e.g. switching symbols) is applied in place; there
is no need to remount the chart.

### Best Practices

1. **Limit initial data**: load a few hundred bars, then page back with `onLoadMoreData`.
2. **Throttle real-time updates**: updating `bars` more than a few times per second rarely helps.
3. **Memoize array props** (`lines`, `trades`, `markers`, `signposts`, `railMarkers`,
   `priceBands`, `sessions` config, `theme`): a new identity re-applies that layer.
4. **Memoize callbacks** with `useCallback` where they feed your own effects.

Indicator results are cached per instance and recomputed when the instance's settings change
or when the bars change at either end (first or last timestamp, or the last bar's OHLCV).

## Troubleshooting

### Bars Not Displaying

- Timestamps must be milliseconds, not seconds.
- Fields must be numbers, not strings.
- All required fields (`timestamp`, `open`, `high`, `low`, `close`, `volume`) must be present.
- Check the parent's height: see [Chart Has the Wrong Height](#chart-has-the-wrong-height).

```typescript
// Wrong
bars: [{ timestamp: "1700000000", open: "100", ... }]

// Correct
bars: [{ timestamp: 1700000000000, open: 100, ... }]

// Converting
const fromSeconds = apiData.map((bar) => ({ ...bar, timestamp: bar.timestamp * 1000 }));
const fromIso = new Date(isoString).getTime();
```

### Chart Has the Wrong Height

Without a `height` prop the chart fills its parent. If the parent has no definite height
(for example a plain `div` in normal flow, or a flex child without `min-height: 0`), the
chart falls back to 600px. Give the parent a height, or pass `height`. Width always follows
the container; no ResizeObserver of your own is needed.

### Indicators Not Updating

Indicators recompute when their settings change (`updateIndicatorSettings`) or when the bars
change at either end. If you mutate a bar strictly inside the history while keeping the bar
count and both end bars unchanged, call `indicatorCalculator.invalidateCache(instanceId)`
(exported from the package) or pass a new instance.

Also check the indicator id is registered (`indicatorRegistry`) and its settings are valid.

### Lines Not Appearing

- The line's price must be within the visible price range.
- The line color must differ from the background.
- Line `id`s must be unique.
- A time-bounded line (with `startTime` and `endTime`) only draws while its window is in
  view, and is dropped if it ends before the first bar.

### Bar Selection Not Working

- `enableBarSelection` must not be `false`.
- In controlled mode (`selectedBarTime` passed, including `null`), clicks only fire
  `onBarClick`; you must update `selectedBarTime` from it, or the spotlight never moves.

### Loading Indicator Lingers

"Loading more data..." clears when older bars arrive or the callback's promise settles. If
it stays for up to 10 seconds after a load that found nothing, the callback returned no
promise: make it `async` and `await` the fetch, or return the fetch's promise.

### No More Loads at the Left Edge

After a load that added no older bars, the chart waits for the view to leave the left edge
and come back before asking again. Scroll right a little, then back. Bars must be prepended
with timestamps older than the current oldest bar; bars at or after it do not count.

## TypeScript Types

The data types are shown with their features above: [`OHLCVBar`](#ohlcvbar-interface),
[`ChartLine`](#chartline-interface), [`ChartTrade`](#trade-markers--popup),
[`ChartMarker`](#markers), [`ChartSignpost` / `ChartRailMarker`](#signposts-and-the-event-rail),
`PriceBand` ([time-bounded overlays](#time-bounded-overlays-segments--boxes)), and
`ChartTheme` ([Theming](./theming.md)). All are exported from the package root, along with
`ChartComponentProps`, `VolumeMode`, `ContextMenuItem`, `OhlcLegendData`, `OhlcLegendIndicator`, `SessionsConfig`, `SessionDef`,
`LineChartSeries`, `LineChartProps`, `IndicatorInstance`, `PersistenceAdapter`, and the
adapter types (`BarDataAdapter`, `HistoricalDataParams`, `RealtimeHandlers`, ...).
The [Props Reference](#props-reference) lists every prop.

## Related Documentation

- [Indicators](./indicators.md) - Built-in indicators and their settings
- [Creating Indicators](./creating-indicators.md) - Build custom technical indicators
- [Data Management](./data-management.md) - `useBarsData`, adapters, and integration recipes
- [Theming](./theming.md) - Chart `theme` prop and `--ck-*` CSS variables
- [Architecture](./architecture.md) - System architecture and design decisions
- [API Reference](./api-reference.md) - Complete API documentation
- [Examples](./examples.md) - More example implementations
- [Lightweight Charts](../learnings/lightweight-charts.md) - Notes on the underlying chart library
