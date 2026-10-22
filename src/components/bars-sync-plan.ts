import type { OHLCVBar } from '../types/chart';

/**
 * How to bring the series from `prev` to `next` (both ascending, deduped):
 * - `set`: replace everything with `setData` — first load, a longer or shorter
 *   series, a prepended page, or a different series altogether;
 * - `update`: only the last bar changed (a forming bar ticking), so a single
 *   `update` keeps the view and is cheap;
 * - `none`: nothing changed.
 */
export type BarsSyncPlan = 'set' | 'update' | 'none';

function sameBar(a: OHLCVBar, b: OHLCVBar): boolean {
  return (
    a === b ||
    (a.timestamp === b.timestamp &&
      a.open === b.open &&
      a.high === b.high &&
      a.low === b.low &&
      a.close === b.close &&
      a.volume === b.volume)
  );
}

export function planBarsSync(prev: OHLCVBar[], next: OHLCVBar[]): BarsSyncPlan {
  if (prev.length === 0) return next.length === 0 ? 'none' : 'set';
  if (next.length !== prev.length) return 'set';
  const last = next.length - 1;
  // Every bar but the last must match: two symbols over the same window share
  // their timestamps, so comparing the ends alone would keep the old candles.
  for (let i = 0; i < last; i += 1) {
    if (!sameBar(prev[i], next[i])) return 'set';
  }
  if (prev[last].timestamp !== next[last].timestamp) return 'set';
  return sameBar(prev[last], next[last]) ? 'none' : 'update';
}
