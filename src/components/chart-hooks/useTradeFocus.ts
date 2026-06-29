import { useEffect, type MutableRefObject } from 'react';
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

/**
 * Recenter the time scale on `focusTradeId` so the trade scrolls into view.
 * Re-runs when the focus target or the loaded bars change (the bars covering
 * the trade may arrive after selection), then frames [entry, exit] with pad.
 * The range is applied on the next animation frame so it lands AFTER the
 * sibling bars→setData effect (which would otherwise snap the view back).
 */
export function useTradeFocus({
  chartRef,
  candlestickSeriesRef,
  bars,
  trades,
  focusTradeId,
}: UseTradeFocusArgs) {
  useEffect(() => {
    if (!chartRef.current || !focusTradeId) return;
    const trade = trades.find((t) => t.id === focusTradeId);
    if (!trade) return;
    // Frame by LOGICAL (bar-index) range, not time: lazy-loading a far-off trade
    // leaves a big gap between bar clusters, and a time-based setVisibleRange
    // won't reliably land on the far cluster. Build the same ascending, deduped
    // order candlekit feeds to setData so indices line up, then frame the trade.
    const seen = new Set<number>();
    const series: number[] = [];
    for (const b of [...bars].sort((a, b) => a.timestamp - b.timestamp)) {
      if (seen.has(b.timestamp)) continue;
      seen.add(b.timestamp);
      series.push(b.timestamp);
    }
    if (series.length === 0) return;
    // First bar index at/after a target ms (binary search; series is ascending).
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
    const entryIdx = nearestIdx(trade.entryTime);
    const exitIdx = Math.max(entryIdx, nearestIdx(trade.exitTime));
    const PAD = TRADE_FOCUS_PAD;
    const frame = () => {
      try {
        // Ensure the candle price axis auto-fits the framed window. On the initial
        // load setData auto-scrolls to the latest bars (a different price level)
        // and leaves the scale there; re-asserting autoScale *before* moving the
        // visible range makes lightweight-charts re-fit to the trade's candles
        // (otherwise they sit off-screen until the next scroll/zoom).
        candlestickSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: entryIdx - PAD,
          to: exitIdx + PAD,
        });
      } catch {
        /* bars not yet present; a later bars update re-runs this */
      }
    };
    // rAF for a snappy frame on navigation; a short timeout repeats it after the
    // initial setData's auto-scroll has settled so the first open frames too.
    const raf = requestAnimationFrame(frame);
    const timer = setTimeout(frame, TRADE_FOCUS_RETRY_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [focusTradeId, trades, bars]);
}
