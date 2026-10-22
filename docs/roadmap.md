# candlekit roadmap / backlog

Living backlog of candidate features. **Prioritization is workbench-centric** for now —
candlekit's primary consumer is the lane-engine research workbench, so features that aid
*reviewing/replaying/annotating historical setups* rank above general-purpose or live-trading
features. Re-rank when/if candlekit targets a broader public-charting audience.

Status legend: **▶ Next** · **◷ Deferred** · **○ Backlog**

---

## ✅ Shipped (0.7.0)

### POINTS indicator series type
- **`ChartSeriesType.POINTS`** — an indicator drawn as point markers on the price pane: a finite
  output value is a point at that bar and price, NaN is none. `renderConfig.pointShape` /
  `pointPosition` (`atPrice` | `aboveBar` | `belowBar`) / `pointSize`, overridable by same-named
  instance settings; `pointFields` draws several named outputs, each in its own colour. Rendered
  through one lightweight-charts markers plugin per field (`createSeriesMarkers`) on the candlestick
  series, so points live in the indicator browser, settings dialog and persistence like any other
  indicator, and never clobber the trade / `markers`-prop markers. Pure mapping in
  `indicator-points.ts` (unit-tested), plus a hook test for teardown and coexistence.
- **Built-in Swing Points** (`swingpoints`) — dots at swing highs / lows, `strength` bars each side.
  Lagging: drawn at the pivot bar, confirmed `strength` bars later.

## ✅ Shipped (0.5.0)

### Free-standing markers, muted trades, bars replacement fix
- **`markers` prop** (`ChartMarker[]`) — circle / square / arrow markers with optional text at any
  time, snapped down to a bar, drawn at an exact `price` (`atPriceTop/Middle/Bottom`) or
  above/below the bar. Merged with the trade + selection markers. Pure `buildChartMarkers`
  (unit-tested). Needs lightweight-charts ≥ 5.1 (peer range raised to `^5.1.0`).
- **`ChartTrade.muted`** — a trade's markers in its outcome hue at reduced opacity, for context
  trades (refused / counterfactual / co-fired) beside the reviewed ones.
- **Fix: replacing `bars`** with a shorter series, a shifted window, or a different series on the
  same timestamps now redraws. Previously only the first load or a longer series called `setData`
  (everything else patched the last bar), so hosts had to remount the chart. Pure `planBarsSync`
  (unit-tested).

Partially addresses the deferred *Event overlays* item (point events as markers; vertical event
lines are still open).

## ✅ Shipped (0.4.2)

### Colored overlay labels
A time-bounded `PriceBand` (box) takes optional `topLabelColor` / `bottomLabelColor` (CSS colors) for its
`topLabel` / `bottomLabel`, threaded into `TradeOverlaysPrimitive` — e.g. green `+R` (favorable MFE) / red
`−R` (adverse MAE) on an MFE↔MAE excursion box. Each defaults to the box's border color, then a neutral
slate, so existing bands are unchanged.

## ✅ Shipped (0.4.1)

### Bounded-box edge labels
A time-bounded `PriceBand` (box) takes optional `topLabel`/`bottomLabel` strings, drawn inside the
box at its top/bottom edge (e.g. the favorable `+R` / adverse `−R` of an MFE↔MAE excursion).

## ✅ Shipped (0.4.0)

### Time-bounded overlays + hovered-bar callback
`ChartLine` / `PriceBand` gain optional `startTime`/`endTime` (epoch ms): when both are set they
render as a finite **segment** / **box** spanning only that window (via a new
`TradeOverlaysPrimitive`) and **auto-hide when scrolled out of view** — the position-tool look for
trade entry/stop/target + MFE↔MAE. New `onHoverBar(timeMs|null)` prop surfaces the crosshair's
hovered bar so a host can show a trade's overlays only while hovering its bars. Also: indicator
`renderConfig.priceLineVisible`/`lastValueVisible` (so a per-day level can drop the misleading
full-width last-value line) and single-output **line indicators render gaps as whitespace** (break,
not connect — clean per-day segments). Pure clip math in `overlay-geometry.ts`; primitive + hook
mirror `SessionsPrimitive`/`useSessions`. (Partially addresses the deferred "Event overlays" item —
same time-anchored primitive approach.)

## ✅ Shipped (0.3.2)

### Interactive price lines
(1) **Drag a price line to reprice** it — grab a line (cursor → `ns-resize`), drag vertically, it
follows the cursor live (pan frozen during the drag), and on release `onLineMove(id, price)` fires.
(2) **Double-click a price line to edit** it — opens the built-in `LineSettingsDialog`
(label/color/style/width); on save `onLineChange(line)` fires. Per-line gates `draggable` / `editable`
(default true; read-only overlays set both `false`). Hit-testing lives in pure `src/utils/nearestLine.ts`;
the drag/dblclick state machine extends `useChartLifecycle`'s mouse handlers (shared `priceLineRefs`).

## ✅ Shipped (0.3.0)

### Session shading + day separators
Pre-market / RTH / after-hours background shading + day-boundary separators, via a custom
`SessionsPrimitive` (`src/indicators/primitives/SessionsPrimitive.ts`) + pure logic in
`src/sessions/sessions.ts`. `ChartComponent` prop `sessions` (`true` = US-equity preset, or a
`SessionsConfig`). **Event overlays were split out and deferred** (see below).

### Crosshair OHLC readout
`showOhlcLegend` / `renderOhlcLegend` on `ChartComponent` — a top-left legend (O/H/L/C/V +
change% + indicator values; idle = last bar). `useOhlcLegend` + `OhlcLegend` + pure
`ohlcLegendData.ts`.

## ◷ Deferred

### Event overlays
Event markers/lines (earnings, splits, news, FOMC, or lane-engine domain events like regime
transitions / detected trigger firings) at timestamps. Deferred from the 0.3.0 session work
pending a decision on what the workbench feeds in (likely lane-engine domain events, not
external earnings data). Reuses the `SessionsPrimitive` time-anchored drawing approach.

### First-class realtime price syncing — *leading live-use candidate*
candlekit already has the plumbing to stream bars — `useBarsData.subscribe`/`onBar`/`onTrade`, the
`AlpacaBarAdapter` WS + `MockAdapter` ticks, and the incremental last-bar `update()` path. "First-class"
is the polish that makes a live chart *feel* live:

- **Forming-bar aggregation** — fold ticks into the current (open) bar between closes; roll to a fresh
  bar at each boundary (needs the chart's timeframe → pairs with *Client-side timeframe aggregation*).
- **Live price line + axis tag** — a horizontal line at last price with a colored axis label (up/down
  vs prev close), updated per tick.
- **Bar-close countdown** — time remaining in the forming bar (small overlay / axis annotation).
- **Connection state as a prop/callback** — connecting / connected / reconnecting / stalled, so the host
  can render stream health (mirrors the exec console's WS-health pattern).
- **Reconnect gap-fill** — on WS reconnect, REST-backfill the bars missed during the gap and dedupe them
  into the series (the historical fetch path already exists).
- **rAF-throttled updates** — coalesce bursty ticks to one repaint per frame (never `setData` per tick).

Deferred only because the workbench is research (historical, not live). **Promote to ▶ Next** the moment
candlekit drives a live surface — e.g. the exec operator console showing a live open position, or a
realtime demo tab. Most of the work is a `useRealtimeBars` hook + a live-price-line primitive; the
adapters are done.

## ○ Backlog (unranked candidates)

- **Drawing tools** — trendlines, rays, rectangles, fib retracement, and a measure tool
  (drag → %/price/bars/time). Scaffolding exists (price lines + context menu + persistence
  adapters); freeform drawing is the next layer. Persist via the indicator-persistence pattern.
- **Trade replay / playback** — scrub bar-by-bar with play/pause/speed; reuses the bar-selection
  cursor. *Strong workbench fit* ("what would I have seen here?").
- **Price / indicator alerts** — draggable alert line firing a callback on cross; indicator
  crossovers (RSI>70, MA cross). Fits the price-line machinery; more live-trading than research.
- **Multi-chart sync / symbol compare** — shared crosshair + time scale across stacked charts
  (multi-timeframe); overlay a 2nd symbol normalized to % (relative strength).
- **Client-side timeframe aggregation** — resample one feed (1m → 5m/15m/1h) + a TF switcher;
  pairs with realtime.
- **DX / infra** — a `defineIndicator()` helper (settings builders + Zod schemas already exist),
  PNG/SVG export (`chart.takeScreenshot()`), Storybook to replace the single demo page.
- **Indicator-on-indicator** — e.g. RSI of EMA; compose calculators.

---

*Updated as features land or priorities shift. See `docs/chart-component.md` for the current API.*
