# Indicators

candlekit ships 23 built-in indicators and the pieces to let users add, configure and save
them: `useChartAPI` holds the active set, `IndicatorBrowser` and `SettingsDialog` are the UI,
and a persistence adapter saves it. To write your own, see
[Creating Indicators](./creating-indicators.md).

## Setup

Register the built-ins once, at module level:

```tsx
import { useState } from 'react';
import {
  ChartComponent,
  IndicatorBrowser,
  SettingsDialog,
  createPersistenceAdapter,
  registerBuiltInIndicators,
  useChartAPI,
  type IndicatorInstance,
  type OHLCVBar,
} from '@adrienhobbs/candlekit';

registerBuiltInIndicators();

// One adapter per chart, created once (the hook reloads when the adapter changes).
const persistence = createPersistenceAdapter('localStorage', { key: 'my-app.chart.indicators' });

function Chart({ bars }: { bars: OHLCVBar[] }) {
  const { indicators, addIndicator, removeIndicator, updateIndicatorSettings } =
    useChartAPI({ persistenceAdapter: persistence });
  const [browserOpen, setBrowserOpen] = useState(false);
  const [editing, setEditing] = useState<IndicatorInstance | null>(null);

  return (
    <>
      <button onClick={() => setBrowserOpen(true)}>+ Indicator</button>
      {indicators.map((ind) => (
        <span key={ind.id}>
          <button onClick={() => setEditing(ind)}>{ind.name}</button>
          <button onClick={() => removeIndicator(ind.id)}>✕</button>
        </span>
      ))}

      <ChartComponent bars={bars} indicators={indicators} />

      <IndicatorBrowser
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onAddIndicator={(id) => addIndicator(id)}
      />
      <SettingsDialog
        isOpen={editing != null}
        indicator={editing}
        onClose={() => setEditing(null)}
        onSave={(id, settings) => {
          updateIndicatorSettings(id, settings);
          setEditing(null);
        }}
      />
    </>
  );
}
```

- **Adding with settings.** `addIndicator(id, settings?)` merges `settings` over the
  definition's defaults, e.g. `addIndicator('swingpoints', { plotAt: 'confirmation' })`.
- **Several instances.** Each `addIndicator` call adds a new instance (`SMA(1)`, `SMA(2)`, …)
  with its own settings.
- **Dialogs and Escape.** `IndicatorBrowser` and `SettingsDialog` close on Escape and consume
  the key, so a host modal that also closes on Escape stays open.

## Persistence

| Adapter | Behaviour |
|---------|-----------|
| none (omit `persistenceAdapter`) | Nothing is loaded or saved; the set resets on reload. |
| `createPersistenceAdapter('noop')` | Same, as an explicit adapter. |
| `createPersistenceAdapter('localStorage')` | Saved under `chart_indicators` (`DEFAULT_INDICATORS_STORAGE_KEY`). Every chart using it shares one set. |
| `createPersistenceAdapter('localStorage', { key })` | Saved under `key`, so each chart keeps its own set. |
| your own `PersistenceAdapter` | Implement `saveIndicators`, `loadIndicators` and `deleteIndicator` to store sets anywhere (a server, IndexedDB). |

## Built-in indicators

"Price" indicators draw over the candles; the others get their own pane below. Every
indicator also has colour settings, and line indicators a `lineWidth`.

| ID | Name | Category | Pane | Settings (default) |
|----|------|----------|------|--------------------|
| `sma` | SMA | Trend | price | `period` 20 |
| `ema` | EMA | Trend | price | `period` 12 |
| `wma` | WMA | Trend | price | `period` 20 |
| `adx` | ADX | Trend | own | `period` 14 |
| `psar` | Parabolic SAR | Trend | price | `step` 0.02, `max` 0.2 |
| `supertrend` | SuperTrend | Trend | price | `period` 10, `multiplier` 3 |
| `ichimoku` | Ichimoku Cloud | Trend | price | `conversionPeriod` 9, `basePeriod` 26, `spanPeriod` 52, `displacement` 26, `showCloud` true |
| `swingpoints` | Swing Points | Trend | price | `strength` 3, `plotAt` `'pivot'`, `pointSize` 1 |
| `rsi` | RSI | Momentum | own | `period` 14 |
| `macd` | MACD | Momentum | own | `fastPeriod` 12, `slowPeriod` 26, `signalPeriod` 9 |
| `stochastic` | Stochastic Oscillator | Momentum | own | `period` 14, `signalPeriod` 3 |
| `stochrsi` | Stochastic RSI | Momentum | own | `rsiPeriod` 14, `stochPeriod` 14, `kPeriod` 3, `dPeriod` 3 |
| `williamsr` | Williams %R | Momentum | own | `period` 14 |
| `roc` | ROC | Momentum | own | `period` 12 |
| `cci` | CCI | Oscillators | own | `period` 20 |
| `bollinger` | Bollinger Bands | Volatility | price | `period` 20, `stdDev` 2, `showFill` true |
| `keltner` | Keltner Channels | Volatility | price | `period` 20, `atrPeriod` 10, `atrMultiplier` 2, `showFill` true |
| `donchian` | Donchian Channels | Volatility | price | `period` 20, `showFill` true |
| `atr` | ATR | Volatility | own | `period` 14 |
| `vwap` | VWAP | Volume | price | `reset` `'daily'`, `bandMultiplier` 1, `showBands` true, `showFill` true |
| `obv` | OBV | Volume | own | none |
| `mfi` | MFI | Volume | own | `period` 14 |
| `forceindex` | Force Index | Volume | own | `period` 13 |

### Swing Points

Dots at swing highs and lows: a bar whose high (low) is beyond the highs (lows) of the
`strength` bars on each side. It is a `POINTS` indicator (see
[Creating Indicators](./creating-indicators.md)), drawn as markers on the price pane.

A swing is only known `strength` bars after the bar it marks. `plotAt` picks where the dot goes:

- `'pivot'` (default): on the swing bar itself. Reads naturally on history, but on a live chart
  the newest `strength` bars never carry a dot, and dots appear after the fact.
- `'confirmation'`: on the bar where the swing became known, still at the swing's price. Use it
  when the chart must not show anything earlier than it was known (replays, blind reviews).

The pure function is exported as `swingPoints(bars, strength, plotAt?)`.

## Calculation

Built-in maths uses `fast-technical-indicators`, bundled into candlekit's `dist/` (you don't
install it; the package also loads under Node). Results are cached per instance and recomputed
when the bars or the instance's settings change.
