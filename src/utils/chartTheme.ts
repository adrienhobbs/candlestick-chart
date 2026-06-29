import { ColorType, type ChartOptions, type DeepPartial } from 'lightweight-charts';
import type { ChartTheme } from '../types/chart';

// Library default chart theme (slate dark). Consumers override via a `theme` prop.
// Shared by ChartComponent (candles) and LineChart (multi-series) so the base
// palette has a single source of truth.
export const DEFAULT_CHART_THEME: ChartTheme = {
  background: '#0f172a',
  textColor: '#94a3b8',
  fontFamily: undefined,
  gridColor: '#1e293b',
  axisBorderColor: '#334155',
  crosshairColor: '#475569',
  paneSeparatorColor: '#1e293b',
  upColor: '#10b981',
  downColor: '#ef4444',
  volumeUpColor: '#10b98180',
  volumeDownColor: '#ef444480',
};

/** Merge a partial theme over {@link DEFAULT_CHART_THEME}. */
export function resolveChartTheme(theme?: Partial<ChartTheme>): ChartTheme {
  return { ...DEFAULT_CHART_THEME, ...theme };
}

/**
 * The non-candle `createChart` / `applyOptions` block that ChartComponent and
 * LineChart share: background, grid, axes, pane separator, and crosshair colors.
 * Series-specific options (candles, volume, lines) are layered on by each
 * component. Use for both initial creation and live re-theming.
 */
export function buildBaseChartLayoutOptions(theme: ChartTheme): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { type: ColorType.Solid, color: theme.background },
      textColor: theme.textColor,
      ...(theme.fontFamily ? { fontFamily: theme.fontFamily } : {}),
      panes: {
        enableResize: true,
        separatorColor: theme.paneSeparatorColor,
        separatorHoverColor: 'rgba(148,163,184,0.5)',
      },
    },
    grid: {
      vertLines: { color: theme.gridColor },
      horzLines: { color: theme.gridColor },
    },
    timeScale: { borderColor: theme.axisBorderColor },
    rightPriceScale: { borderColor: theme.axisBorderColor },
    crosshair: {
      mode: 0,
      vertLine: { width: 1, color: theme.crosshairColor, style: 3 },
      horzLine: { width: 1, color: theme.crosshairColor, style: 3 },
    },
  };
}
