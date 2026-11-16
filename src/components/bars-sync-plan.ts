import type { OHLCVBar } from '../types/chart';

/**
 * How to bring the series from `prev` to `next` (both ascending, deduped):
 * - `set`: replace everything with `setData` — first load, a shorter series, a
 *   prepended page, several new bars, or a different series altogether;
 * - `update`: only the last bar changed (a forming bar ticking), so a single
 *   `update` keeps the view and is cheap;
 * - `append`: one new bar after unchanged bars (a live rollover); the old last
 *   bar may have changed too. One or two `update` calls, no `setData`;
 * - `none`: nothing changed.
 */
export type BarsSyncPlan = 'set' | 'update' | 'append' | 'none';

export function sameBar(a: OHLCVBar, b: OHLCVBar): boolean {
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

/**
 * Every bar before `prev`'s last matches, and the last keeps its timestamp. Two
 * symbols over the same window share their timestamps, so comparing the ends
 * alone would keep the old candles.
 */
function samePrefix(prev: OHLCVBar[], next: OHLCVBar[]): boolean {
  const last = prev.length - 1;
  for (let i = 0; i < last; i += 1) {
    if (!sameBar(prev[i], next[i])) return false;
  }
  return prev[last].timestamp === next[last].timestamp;
}

export function planBarsSync(prev: OHLCVBar[], next: OHLCVBar[]): BarsSyncPlan {
  if (prev.length === 0) return next.length === 0 ? 'none' : 'set';
  const last = prev.length - 1;
  if (next.length === prev.length + 1) {
    if (!samePrefix(prev, next)) return 'set';
    return next[last + 1].timestamp > next[last].timestamp ? 'append' : 'set';
  }
  if (next.length !== prev.length || !samePrefix(prev, next)) return 'set';
  return sameBar(prev[last], next[last]) ? 'none' : 'update';
}
