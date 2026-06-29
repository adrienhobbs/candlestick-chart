// Pure assembly of the crosshair OHLC legend's data (no chart/canvas), so the change
// math + null handling are unit-testable. The hook (useOhlcLegend) extracts raw values
// from the crosshair event and the series, then calls this.

export interface OhlcLegendIndicator {
  label: string;
  color: string;
  value: number;
}

export interface OhlcLegendData {
  /** lightweight-charts time (seconds) of the bar, or null. */
  time: number | null;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume, or null when unavailable. */
  volume: number | null;
  /** `close - open`. */
  changeAbs: number;
  /** `(close - open) / open * 100`, or 0 when open is 0. */
  changePct: number;
  indicators: OhlcLegendIndicator[];
}

export interface OhlcLegendInput {
  time: number | null;
  ohlc: { open: number; high: number; low: number; close: number } | null;
  volume: number | null;
  indicators: OhlcLegendIndicator[];
}

/** Assemble legend data + change math; returns null when there's no OHLC bar. */
export function buildOhlcLegendData(input: OhlcLegendInput): OhlcLegendData | null {
  if (!input.ohlc) return null;
  const { open, high, low, close } = input.ohlc;
  const changeAbs = close - open;
  const changePct = open !== 0 ? (changeAbs / open) * 100 : 0;
  return {
    time: input.time,
    open,
    high,
    low,
    close,
    volume: input.volume,
    changeAbs,
    changePct,
    indicators: input.indicators,
  };
}
