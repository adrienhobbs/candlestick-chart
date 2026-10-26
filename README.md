# candlekit

A React candlestick chart for reviewing trades, built on TradingView's
[Lightweight Charts](https://tradingview.github.io/lightweight-charts/), with a pluggable
indicator system. Published as [`@adrienhobbs/candlekit`](https://www.npmjs.com/package/@adrienhobbs/candlekit).

**[Live demo](https://adrienhobbs.github.io/candlestick-chart/)**: hover a trade to see its
entry, stop, target and MFE↔MAE box; right-click to add a line, drag it to reprice,
double-click to edit; focus a trade from the list; add Swing Points or any other indicator.

## Install

```bash
npm install @adrienhobbs/candlekit lightweight-charts react react-dom
```

`lightweight-charts` (^5.1), `react` and `react-dom` (>=18) are peer dependencies.

```tsx
import { ChartComponent } from '@adrienhobbs/candlekit';
import '@adrienhobbs/candlekit/styles.css';

<div style={{ height: 480 }}>
  <ChartComponent bars={bars} />
</div>
```

`bars` are `{ timestamp, open, high, low, close, volume }` with `timestamp` in milliseconds.
With no `height` prop the chart fills its parent (600px if the parent has no height).

The package also imports under Node, so host unit tests and SSR can load it.

## Features

**Chart**
- Candles and volume (its own pane or an overlay on the price pane), infinite scroll back
  through history (`onLoadMoreData`), bar selection
  (clicked or controlled with `selectedBarTime`), crosshair OHLC legend, session shading and
  day separators, axis times in any IANA time zone, and a theme for the canvas and the dialogs.

**Trades and annotations**
- `trades`: entry/exit marks coloured by outcome, either ▲/▼ arrows or ▶/◀ at the fill
  prices (`markerStyle: 'price'`); `muted` for context trades; `focusTradeId` scrolls a trade
  into view once and leaves the view alone after that; `renderTradePopup`.
- Time-bounded lines and boxes (`startTime`/`endTime` on `lines` and `priceBands`): a trade's
  entry, stop and target segments and a labelled MFE↔MAE box that hide when scrolled away.
- `markers` at any time and price (including ▶/◀ and hollow outlines), `signposts` (a dashed
  line with a label pill on the top edge), and `railMarkers` (an event strip along the
  bottom of the price pane for events without a price).
- `onHoverBar` for hover-driven UI.

**Lines**
- Price lines with a right-click menu (built-in or your own items), drag to reprice
  (`onLineMove`), double-click to edit (`onLineChange`), delete buttons, and per-line
  read-only flags.

**Indicators**
- 23 built-ins (moving averages, oscillators, channels, VWAP, Ichimoku, Swing Points, …),
  an indicator browser, and settings forms generated from each indicator's settings schema.
- Custom indicators as lines, histograms, areas or points (`ChartSeriesType.POINTS`).
- Saved to localStorage under a key per chart, or any adapter you write.

**Data**
- `useBarsData` with adapters for any provider: `AlpacaBarAdapter` (REST + WebSocket) and
  `MockAdapter` are included, and bar utilities cover validation, deduplication and merging.

**Also**
- `LineChart`: several line series on one pane over an ordinal x-axis, e.g. equity curves.

## Documentation

- [ChartComponent](./docs/chart-component.md): props, features, troubleshooting
- [Indicators](./docs/indicators.md): using the built-ins, persistence, the catalog
- [Creating Indicators](./docs/creating-indicators.md): write your own
- [Data Management](./docs/data-management.md): `useBarsData`, adapters, bar utilities
- [Theming](./docs/theming.md): the `theme` prop and the `--ck-*` CSS variables
- [API Reference](./docs/api-reference.md) and [Examples](./docs/examples.md)
- [Architecture](./docs/architecture.md): how the pieces fit
- [Roadmap](./docs/roadmap.md): what shipped in each version and what's next

## Developing

```bash
npm install
npm run dev          # the demo page, on mock data
npm test             # vitest
npm run typecheck
npm run build:lib    # dist/ (tsup + CSS), then checks dist/index.js imports under Node
npm run build:demo   # demo-dist/, deployed to GitHub Pages on push to main
```

The demo (`src/App.tsx`) imports from the package's public entry (`src/index.ts`), so it
only uses what consumers can.

To run the demo on real data, copy `.env.example` to `.env` and fill in Alpaca credentials
(a free [paper trading](https://app.alpaca.markets/paper/dashboard/overview) account works):

```
VITE_ALPACA_API_KEY=your-api-key
VITE_ALPACA_SECRET_KEY=your-secret-key
```

## License

MIT
