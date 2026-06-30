# candlekit roadmap / backlog

Living backlog of candidate features. **Prioritization is workbench-centric** for now —
candlekit's primary consumer is the lane-engine research workbench, so features that aid
*reviewing/replaying/annotating historical setups* rank above general-purpose or live-trading
features. Re-rank when/if candlekit targets a broader public-charting audience.

Status legend: **▶ Next** · **◷ Deferred** · **○ Backlog**

---

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

### First-class realtime price syncing
Primitives already exist (`useBarsData.subscribe`/`onBar`/`onTrade`, `AlpacaBarAdapter` WS,
`MockAdapter` ticks, last-bar `update()` path). "First-class" = forming-bar tick aggregation,
live price line + axis tag, bar-close countdown, connection-state surfaced as a prop/callback,
reconnect gap-fill (REST backfill of missed bars), and rAF-throttled updates. Deferred while
focus is workbench (research = historical, not live).

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
