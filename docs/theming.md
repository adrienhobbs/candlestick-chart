# Theming

candlekit ships a slate dark theme by default. There are two independent surfaces
you can restyle:

1. **The chart canvas** (background, grid, axes, candles, volume, trade markers) —
   themed with the **`theme` prop** on `<ChartComponent>`.
2. **The React modals/popups** (the indicator browser and the settings dialog) —
   themed with **`--ck-*` CSS variables**.

They are separate because the chart is drawn on a `<canvas>` (which cannot read CSS
custom properties), while the modals are regular DOM you can style with CSS.

---

## 1. Chart canvas — the `theme` prop

Pass a `Partial<ChartTheme>` to `<ChartComponent theme={...} />`. Any key you omit
falls back to the library default (the slate dark look), so you can override just a
few colors or all of them. The theme is applied at creation **and re-applied live**
when the prop changes — so wiring it to a host app's dark/light toggle re-themes the
chart in place (no remount).

```ts
import type { ChartTheme } from '@adrienhobbs/candlekit';

export interface ChartTheme {
  background: string;          // pane background
  textColor: string;           // axis tick + label text
  fontFamily?: string;         // axis/crosshair label font (optional)
  gridColor: string;           // grid lines
  axisBorderColor: string;     // price/time axis border line
  crosshairColor: string;      // crosshair lines (also the bar-selection dot)
  paneSeparatorColor: string;  // separator between price / volume / indicator panes
  upColor: string;             // bullish candle body + wick, and win trade markers
  downColor: string;           // bearish candle body + wick, and loss trade markers
  volumeUpColor: string;       // up volume bar (an alpha suffix is fine: "#8fbc8f59")
  volumeDownColor: string;     // down volume bar
}
```

> **Resolve tokens to concrete colors.** The canvas can't read CSS variables, so if
> your colors come from CSS custom properties, read them with
> `getComputedStyle(document.documentElement).getPropertyValue('--token')` and pass
> the resolved strings. `upColor`/`downColor` also color the win/loss trade markers,
> so markers stay consistent with the candles automatically.

### Example — a brutalist theme that follows `data-theme`

Because the canvas needs concrete colors, re-read your design tokens whenever the
theme flips. A `MutationObserver` on the `data-theme` attribute fires *after* the
attribute changes, so `getComputedStyle` returns the new values (a plain
`useMemo(..., [theme])` would read the pre-toggle values):

```tsx
import { useEffect, useState } from 'react';
import { ChartComponent, type ChartTheme } from '@adrienhobbs/candlekit';

const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const withAlpha = (hex: string, a: number) =>
  /^#[0-9a-fA-F]{6}$/.test(hex)
    ? hex + Math.round(a * 255).toString(16).padStart(2, '0')
    : hex;

function readChartTheme(): Partial<ChartTheme> {
  const up = cssVar('--positive', '#8fbc8f');
  const down = cssVar('--negative', '#bc8f8f');
  return {
    background: cssVar('--surface-base', '#0a0a0a'),
    textColor: cssVar('--text-secondary', '#a3a3a3'),
    fontFamily: cssVar('--font-family-mono', '"JetBrains Mono", monospace'),
    gridColor: cssVar('--surface-hover', '#262626'),
    axisBorderColor: cssVar('--border', '#404040'),
    crosshairColor: cssVar('--border-strong', '#737373'),
    paneSeparatorColor: cssVar('--border', '#404040'),
    upColor: up,
    downColor: down,
    volumeUpColor: withAlpha(up, 0.35),
    volumeDownColor: withAlpha(down, 0.35),
  };
}

function ThemedChart(props) {
  const [theme, setTheme] = useState<Partial<ChartTheme>>(readChartTheme);
  useEffect(() => {
    const update = () => setTheme(readChartTheme());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return <ChartComponent {...props} theme={theme} />;
}
```

---

## 2. Modals & popups — `--ck-*` CSS variables

The indicator browser (`IndicatorBrowser`), the settings dialogs (`SettingsDialog`
+ its form, and `LineSettingsDialog`), and the chart's right-click line **context
menu** read these CSS custom properties, each with the prior slate value as a
fallback. Set them
anywhere that's an ancestor (`:root` is simplest — these render via `fixed`/absolute
overlays and inherit from the document) and they follow your theme, including a
`data-theme` switch.

| Variable | Default | Used for |
|----------|---------|----------|
| `--ck-overlay` | `rgba(0,0,0,0.5)` | Backdrop behind a modal |
| `--ck-surface` | `#1e293b` | Modal panel background |
| `--ck-surface-2` | `#334155` | Inputs, cards, category chips |
| `--ck-surface-hover` | `#475569` | Hover state for cards/chips |
| `--ck-border` | `#334155` | Borders / dividers |
| `--ck-text` | `#f1f5f9` | Primary text |
| `--ck-text-secondary` | `#cbd5e1` | Secondary text (labels, cancel) |
| `--ck-text-muted` | `#94a3b8` | Muted text (descriptions, placeholders) |
| `--ck-accent` | `#2563eb` | Primary buttons (Add, Save) |
| `--ck-accent-hover` | `#1d4ed8` | Primary button hover |
| `--ck-accent-text` | `#ffffff` | Text on accent buttons |
| `--ck-ring` | `#3b82f6` | Input focus ring |
| `--ck-radius` | `0.5rem` | Corner radius (set `0` for square/brutalist) |
| `--ck-font` | `inherit` | Font family for modal text |

### Example — map them to your design tokens once

```css
:root {
  --ck-overlay: color-mix(in srgb, var(--surface-base) 80%, transparent);
  --ck-surface: var(--surface-elevated);
  --ck-surface-2: var(--surface-base);
  --ck-surface-hover: var(--surface-hover);
  --ck-border: var(--border-strong);
  --ck-text: var(--text-primary);
  --ck-text-secondary: var(--text-secondary);
  --ck-text-muted: var(--text-muted);
  --ck-accent: var(--text-primary);
  --ck-accent-hover: var(--text-secondary);
  --ck-accent-text: var(--surface-base);
  --ck-ring: var(--border-strong);
  --ck-radius: 0px;            /* square corners */
  --ck-font: var(--font-family-mono);
}
```

Because the values are CSS variables, they re-resolve automatically when your tokens
change (e.g. a `[data-theme="light"]` block) — no JavaScript needed for the modals.
