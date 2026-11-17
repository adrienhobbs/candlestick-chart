import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { OHLCVBar, ChartTheme } from '../../types/chart';
import { planBarsSync, sortedUniqueBars, type BarsSyncPlan } from '../bars-sync-plan';
import { applyBarsSync } from '../bars-sync-apply';
import type { LoadMoreGate } from '../load-more-gate';

interface UseBarsSyncArgs {
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  volumeSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>;
  themeRef: MutableRefObject<ChartTheme>;
  loadMoreGateRef: MutableRefObject<LoadMoreGate>;
  previousBarsRef: MutableRefObject<OHLCVBar[]>;
  setIsLoadingMore: Dispatch<SetStateAction<boolean>>;
  bars: OHLCVBar[];
  /** Receives each plan, for the indicator sync that runs after this effect. */
  barsSyncPlanRef?: MutableRefObject<BarsSyncPlan | null>;
}

/**
 * Sync `bars` into the candlestick + volume series, diffing against the previous
 * bars (`planBarsSync`) to choose a full `setData`, a last-bar `update`, or an
 * `append` (a live rollover). Owns the bars-diff trackers shared with the
 * create-once teardown (which resets them for StrictMode's double-mount).
 */
export function useBarsSync({
  candlestickSeriesRef,
  volumeSeriesRef,
  themeRef,
  loadMoreGateRef,
  previousBarsRef,
  setIsLoadingMore,
  bars,
  barsSyncPlanRef,
}: UseBarsSyncArgs) {
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const uniqueBars = sortedUniqueBars(bars);

    const plan = planBarsSync(previousBarsRef.current, uniqueBars);
    if (barsSyncPlanRef) barsSyncPlanRef.current = plan;

    if (loadMoreGateRef.current.onBars(uniqueBars[0]?.timestamp)) setIsLoadingMore(false);

    applyBarsSync(
      plan,
      previousBarsRef.current,
      uniqueBars,
      candlestickSeriesRef.current,
      volumeSeriesRef.current,
      themeRef.current,
    );

    previousBarsRef.current = uniqueBars;
  }, [bars]);
}
