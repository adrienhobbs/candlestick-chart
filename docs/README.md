# candlekit documentation

Start with [ChartComponent](./chart-component.md) to put a chart on the page, then
[Indicators](./indicators.md) to let users add indicators.

| Guide | Covers |
|-------|--------|
| [ChartComponent](./chart-component.md) | Props, data format, trades and overlays, markers, signposts and the event rail, lines, sessions, the OHLC legend, persistence, troubleshooting |
| [Indicators](./indicators.md) | `useChartAPI`, `IndicatorBrowser`, `SettingsDialog`, persistence adapters, the built-in catalog, Swing Points |
| [Creating Indicators](./creating-indicators.md) | Writing an `IndicatorDefinition`: settings, render config (lines, histograms, areas, points), calculation, registration |
| [Data Management](./data-management.md) | `useBarsData`, the adapter interface, `AlpacaBarAdapter`, `MockAdapter`, bar utilities |
| [Theming](./theming.md) | The `theme` prop for the canvas and the `--ck-*` CSS variables for the dialogs |
| [API Reference](./api-reference.md) | The exported indicator-system API |
| [Examples](./examples.md) | Example indicator definitions |
| [Architecture](./architecture.md) | How the component, hooks, primitives and indicator system fit together |
| [Roadmap](./roadmap.md) | What shipped in each version, and candidates for next |

`../learnings/lightweight-charts.md` collects notes on the underlying lightweight-charts
library for contributors.
