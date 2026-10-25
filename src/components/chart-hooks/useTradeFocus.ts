import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { OHLCVBar, ChartTrade } from '../../types/chart';
import { TRADE_FOCUS_PAD, TRADE_FOCUS_RETRY_MS } from '../chart-constants';

interface UseTradeFocusArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  bars: OHLCVBar[];
  trades: ChartTrade[];
  focusTradeId: string | null;
}

/** Where a focused trade lands in the bars: logical indices to frame, and the bars they hit. */
export interface TradeFocusFrame {
  from: number;
  to: number;
  /** Timestamp (ms) of the bar the entry lands on. */
  entryBarTime: number;
  /** Timestamp (ms) of the bar the exit lands on. */
  exitBarTime: number;
}

/**
 * Frame [entry, exit] by LOGICAL (bar-index) range, not time: lazy-loading a far-off
 * trade leaves a big gap between bar clusters, and a time-based setVisibleRange won't
 * reliably land on the far cluster. Uses the same ascending, deduped order candlekit
 * feeds to setData so indices line up. Each end lands on the first bar at/after it
 * (the last bar when it lies past the data).
 */
export function tradeFocusFrame(
  bars: OHLCVBar[],
  entryTime: number,
  exitTime: number,
  pad: number = TRADE_FOCUS_PAD,
): TradeFocusFrame | null {
  const seen = new Set<number>();
  const series: number[] = [];
  for (const b of [...bars].sort((a, b) => a.timestamp - b.timestamp)) {
    if (seen.has(b.timestamp)) continue;
    seen.add(b.timestamp);
    series.push(b.timestamp);
  }
  if (series.length === 0) return null;
  const nearestIdx = (ms: number) => {
    let lo = 0;
    let hi = series.length - 1;
    let idx = series.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid] >= ms) {
        idx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return idx;
  };
  const entryIdx = nearestIdx(entryTime);
  const exitIdx = Math.max(entryIdx, nearestIdx(exitTime));
  return {
    from: entryIdx - pad,
    to: exitIdx + pad,
    entryBarTime: series[entryIdx],
    exitBarTime: series[exitIdx],
  };
}

/**
 * Recenter the time scale on `focusTradeId` so the trade scrolls into view.
 *
 * Re-frames only when the focus target changes, or when the bars its entry and exit
 * land on change (the bars covering the trade may arrive after selection). A new
 * `trades` or `bars` array with the same content, a live tick, or older bars loaded
 * on scroll-back leave the user's view alone.
 *
 * The range is applied on the next animation frame so it lands AFTER the sibling
 * bars→setData effect (which would otherwise snap the view back).
 */
export function useTradeFocus({
  chartRef,
  candlestickSeriesRef,
  bars,
  trades,
  focusTradeId,
}: UseTradeFocusArgs) {
  const trade = focusTradeId ? trades.find((t) => t.id === focusTradeId) : undefined;
  const entryTime = trade?.entryTime;
  const exitTime = trade?.exitTime;
  const frame = useMemo(
    () => (entryTime != null && exitTime != null ? tradeFocusFrame(bars, entryTime, exitTime) : null),
    [bars, entryTime, exitTime],
  );
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    if (!chartRef.current || !frameRef.current) return;
    const apply = () => {
      const target = frameRef.current;
      if (!target) return;
      try {
        // Ensure the candle price axis auto-fits the framed window. On the initial
        // load setData auto-scrolls to the latest bars (a different price level)
        // and leaves the scale there; re-asserting autoScale *before* moving the
        // visible range makes lightweight-charts re-fit to the trade's candles
        // (otherwise they sit off-screen until the next scroll/zoom).
        candlestickSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
        chartRef.current?.timeScale().setVisibleLogicalRange({ from: target.from, to: target.to });
      } catch {
        /* bars not yet present; a later bars update re-runs this */
      }
    };
    // rAF for a snappy frame on navigation; a short timeout repeats it after the
    // initial setData's auto-scroll has settled so the first open frames too.
    const raf = requestAnimationFrame(apply);
    const timer = setTimeout(apply, TRADE_FOCUS_RETRY_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTradeId, frame?.entryBarTime, frame?.exitBarTime]);
}
