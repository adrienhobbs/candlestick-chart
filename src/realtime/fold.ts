import type { OHLCVBar } from '../types/chart';
import { etDateFields } from '../sessions/sessions';
import type { LiveBucketBar, LiveFoldState, RealtimeTick } from './types';

export const INTRADAY_BUCKET_MS: Record<string, number> = {
  '1Min': 60_000,
  '5Min': 5 * 60_000,
  '15Min': 15 * 60_000,
  '1Hour': 60 * 60_000,
};

/** Closed buckets kept while REST lags; at 1Min this is half an hour of bars. */
export const MAX_CLOSED = 30;

const NEW_YORK = 'America/New_York';
const REGULAR_OPEN_MIN = 9 * 60 + 30;
const REGULAR_CLOSE_MIN = 16 * 60;

export function tickTimeMs(time: number | string): number {
  return typeof time === 'number' ? time : Date.parse(time);
}

/** The bucket a tick folds into, or null when it must not be folded. */
export function bucketOf(last: OHLCVBar, timeframe: string, ms: number): number | null {
  const size = INTRADAY_BUCKET_MS[timeframe];
  if (size) return Math.floor(ms / size) * size;
  if (timeframe === '1Day') {
    // Daily bars are regular-session only, and the next day's bar comes from REST.
    const t = etDateFields(ms, NEW_YORK);
    const regular = t.minutesOfDay >= REGULAR_OPEN_MIN && t.minutesOfDay < REGULAR_CLOSE_MIN;
    return regular && t.dayKey === etDateFields(last.timestamp, NEW_YORK).dayKey ? last.timestamp : null;
  }
  return null;
}

function bucketBar(s: LiveBucketBar): LiveBucketBar {
  return { bucket: s.bucket, open: s.open, high: s.high, low: s.low, close: s.close, volume: s.volume };
}

/**
 * Applies a bucket's live shape: widens and re-closes the bar at that bucket, or
 * appends one REST has not returned yet. Unchanged bars come back as the same array.
 */
function mergeBucket(bars: OHLCVBar[], live: LiveBucketBar): OHLCVBar[] {
  const last = bars[bars.length - 1];
  if (live.bucket > last.timestamp) {
    const { bucket, open, high, low, close, volume } = live;
    return [...bars, { timestamp: bucket, open, high, low, close, volume }];
  }
  if (live.bucket !== last.timestamp) return bars;
  const high = Math.max(last.high, live.high);
  const low = Math.min(last.low, live.low);
  const volume = Math.max(last.volume, live.volume);
  if (last.close === live.close && last.high === high && last.low === low && last.volume === volume) return bars;
  const next = bars.slice();
  next[next.length - 1] = { ...last, high, low, close: live.close, volume };
  return next;
}

/** Re-applies the live state (closed buckets REST lacks, then the forming one) to `bars`. */
export function mergeLive(bars: OHLCVBar[], state: LiveFoldState | null): OHLCVBar[] {
  if (state === null || bars.length === 0) return bars;
  const lastTs = bars[bars.length - 1].timestamp;
  // Where REST has a newer bar, its bar for a closed bucket is final.
  const closed = state.closed.filter((c) => c.bucket >= lastTs);
  return [...closed, bucketBar(state)].reduce(mergeBucket, bars);
}

/**
 * Folds one tick into the live state and returns the bars with the live shape
 * applied. Each bucket keeps the high/low of every tick seen in it, so a spike's
 * wick survives the next tick and a REST refetch that lags the stream; the bucket
 * that just closed keeps its live shape until REST returns a newer bar.
 */
export function foldTick(
  prev: LiveFoldState | null,
  input: { key: string; bars: OHLCVBar[]; timeframe: string; tick: RealtimeTick },
): { bars: OHLCVBar[]; state: LiveFoldState | null } {
  const { key, bars, timeframe, tick } = input;
  const base = prev !== null && prev.key === key && prev.timeframe === timeframe ? prev : null;
  const ignored = () => ({ bars: mergeLive(bars, base), state: base });
  const ms = tickTimeMs(tick.time);
  if (!Number.isFinite(tick.price) || !Number.isFinite(ms) || bars.length === 0) return ignored();
  if (base !== null && ms < base.lastTickMs) return ignored();
  const last = bars[bars.length - 1];
  const bucket = bucketOf(last, timeframe, ms);
  if (bucket === null || bucket < last.timestamp) return ignored();

  const same = base !== null && base.bucket === bucket;
  let closed: LiveBucketBar[] = [];
  if (same) closed = base.closed;
  else if (base !== null) closed = [...base.closed, bucketBar(base)].slice(-MAX_CLOSED);
  closed = closed.filter((c) => c.bucket >= last.timestamp);

  const withClosed = closed.reduce(mergeBucket, bars);
  const before = withClosed[withClosed.length - 1];
  // A bucket REST has not returned yet opens at the close of the bar before it.
  const open = same ? base.open : bucket > before.timestamp ? before.close : tick.price;
  const size = tick.size !== undefined && tick.size > 0 ? tick.size : 0;
  const state: LiveFoldState = {
    key,
    timeframe,
    bucket,
    open,
    high: same ? Math.max(base.high, tick.price) : Math.max(open, tick.price),
    low: same ? Math.min(base.low, tick.price) : Math.min(open, tick.price),
    close: tick.price,
    volume: (same ? base.volume : 0) + size,
    lastTickMs: ms,
    closed,
  };
  return { bars: mergeBucket(withClosed, bucketBar(state)), state };
}
