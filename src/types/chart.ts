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
  /**
   * Whether this line shows a delete button (when `onDeleteLine` is wired). Set
   * `false` for derived/read-only lines (e.g. a trade overlay) so they can't be
   * "deleted". Defaults to `true`.
   */
  deletable?: boolean;
  /**
   * Whether this line can be dragged to reprice it (when `onLineMove` is wired).
   * Set `false` for derived/read-only lines (e.g. a trade overlay). Independent
   * of `deletable`/`editable`. Defaults to `true`.
   */
  draggable?: boolean;
  /**
   * Whether double-clicking this line opens the edit dialog (when `onLineChange`
   * is wired). Set `false` for derived/read-only lines. Independent of
   * `deletable`/`draggable`. Defaults to `true`.
   */
  editable?: boolean;
  /**
   * Optional time bounds (epoch ms, matching `OHLCVBar.timestamp`). When BOTH
   * `startTime` and `endTime` are set, the line renders as a finite SEGMENT
   * spanning only `[startTime, endTime]` at its price (drawn on the canvas) and
   * auto-hides when its window scrolls out of view — instead of the default
   * infinite full-width price line. Bounded segments are read-only: they get no
   * axis label, delete button, or drag/edit, and ignore `deletable`/`draggable`/
   * `editable`. Endpoints should align to real bar timestamps.
   */
  startTime?: number;
  endTime?: number;
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
  /**
   * Optional time bounds (epoch ms). When BOTH set, the band renders as a finite
   * BOX spanning `[startTime, endTime] × [top, bottom]` (auto-hides off-screen)
   * instead of a full-width band. Endpoints should align to real bar timestamps.
   */
  startTime?: number;
  endTime?: number;
  /**
   * Optional inline labels drawn inside a time-bounded box at its top / bottom
   * edge (e.g. the favorable `+R` and adverse `−R` of an MFE↔MAE excursion).
   * Ignored for full-width (unbounded) bands.
   */
  topLabel?: string;
  bottomLabel?: string;
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

export interface IndicatorPanel {
  id: string;
  name: string;
  type: 'line' | 'histogram' | 'area';
  /** Resolved setting values (keyed by setting name). */
  settings: Record<string, unknown>;
  data: unknown[];
}
