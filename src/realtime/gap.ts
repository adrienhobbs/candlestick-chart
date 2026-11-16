import type { OHLCVBar } from '../types/chart';
import { intradayBucketMs } from './fold';
import type { GapRange } from './types';

/** The bucket `nowMs` falls in (intraday), or `nowMs` itself for other timeframes. */
export function currentBucket(timeframe: string, nowMs: number): number {
  const size = intradayBucketMs(timeframe);
  return size !== undefined ? Math.floor(nowMs / size) * size : nowMs;
}

/** The range to backfill when a tick lands two or more buckets past the newest bar. */
export function tickGap(newestMs: number | null, timeframe: string, tickMs: number): GapRange | null {
  const size = intradayBucketMs(timeframe);
  if (size === undefined || newestMs === null) return null;
  const bucket = Math.floor(tickMs / size) * size;
  return bucket - newestMs >= 2 * size ? { fromMs: newestMs, toMs: bucket } : null;
}

/** Sorted by time, one bar per timestamp (the later entry wins). */
export function normalizeBars(bars: OHLCVBar[]): OHLCVBar[] {
  const byTime = new Map<number, OHLCVBar>();
  for (const b of bars) if (Number.isFinite(b.timestamp)) byTime.set(b.timestamp, b);
  return [...byTime.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function mergeGapBars(existing: OHLCVBar[], fetched: OHLCVBar[]): OHLCVBar[] {
  return normalizeBars([...existing, ...fetched]);
}

/** Host bars plus the gap bars newer than them; the host's bars win where both exist. */
export function withGapBars(host: OHLCVBar[], gap: OHLCVBar[]): OHLCVBar[] {
  if (gap.length === 0) return host;
  const lastTs = host.length ? host[host.length - 1].timestamp : -Infinity;
  const tail = gap.filter((b) => b.timestamp > lastTs);
  return tail.length === 0 ? host : [...host, ...tail];
}
