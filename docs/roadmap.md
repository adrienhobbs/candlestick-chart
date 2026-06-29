# candlekit roadmap / backlog

Living backlog of candidate features. **Prioritization is workbench-centric** for now —
candlekit's primary consumer is the lane-engine research workbench, so features that aid
*reviewing/replaying/annotating historical setups* rank above general-purpose or live-trading
features. Re-rank when/if candlekit targets a broader public-charting audience.

Status legend: **▶ Next** · **◷ Deferred** · **○ Backlog**

---

## ▶ Next (workbench-driven)

### Session shading + event overlays
Pre-market / RTH / after-hours background shading, day (and week) separators, and event
markers (earnings, splits, news, FOMC) at timestamps. Makes intraday charts legible and
ties setups to context.
- *Fits workbench:* "what regime/session was this setup in?" at a glance.
- *Tech crux:* lightweight-charts has no native vertical/background drawing — needs a custom
  `ISeriesPrimitive` (precedent: `src/indicators/primitives/BandsPrimitive.ts`). Chart is
  already `timeZone`-aware (ET). Events may reuse the existing `SeriesMarker` machinery.

### Crosshair OHLC readout
A legend that follows the crosshair showing O/H/L/C/V, change %, and each active indicator's
value at the hovered bar (falls back to the last bar when not hovering).
- *Fits workbench:* precise per-bar values while inspecting trades/features.
- *Tech:* `subscribeCrosshairMove` + `param.seriesData` (already used by `LineChart`'s legend);
  `ChartComponent` lacks the equivalent. Low effort, universally wanted.

## ◷ Deferred

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
