export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count?: number;
  vwap?: number;
}

export interface ChartLine {
  id: string;
  price: number;
  color: string;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  title?: string;
  type?: 'entry' | 'stopLoss' | 'takeProfit' | 'mfe' | 'mae';
}

/** A shaded horizontal price band (e.g. an MFE↔MAE excursion zone). */
export interface PriceBand {
  id: string;
  /** Upper price bound of the band. */
  top: number;
  /** Lower price bound of the band. */
  bottom: number;
  /** CSS color (use an rgba/low-opacity fill so candles show through). */
  color: string;
}

export interface ChartTrade {
  id: string;
  entryTime: number;   // ms timestamp — must equal an entry bar's timestamp
  exitTime: number;    // ms timestamp — must equal an exit bar's timestamp
  entryPrice: number;
  exitPrice: number;
  outcome: 'win' | 'loss';
}

/**
 * Visual theme for the chart canvas itself (background, grid, axes, crosshair,
 * candles, volume). Pass a partial to `<ChartComponent theme={...} />`; omitted
 * keys fall back to the library default (a slate dark theme). All values are CSS
 * color strings — resolve any design tokens to concrete colors before passing
 * (the canvas can't read CSS custom properties).
 */
export interface ChartTheme {
  /** Pane background. */
  background: string;
  /** Axis tick + label text. */
  textColor: string;
  /** Optional font family for axis/crosshair labels. */
  fontFamily?: string;
  /** Grid lines. */
  gridColor: string;
  /** Price/time axis border line. */
  axisBorderColor: string;
  /** Crosshair lines. */
  crosshairColor: string;
  /** Separator between stacked panes (price / volume / indicators). */
  paneSeparatorColor: string;
  /** Up (bullish) candle body + wick. */
  upColor: string;
  /** Down (bearish) candle body + wick. */
  downColor: string;
  /** Up volume bar (an alpha suffix is fine, e.g. "#8fbc8f59"). */
  volumeUpColor: string;
  /** Down volume bar. */
  volumeDownColor: string;
}

export interface IndicatorSettings {
  [key: string]: any;
}

export interface IndicatorPanel {
  id: string;
  name: string;
  type: 'line' | 'histogram' | 'area';
  settings: IndicatorSettings;
  data: any[];
}
