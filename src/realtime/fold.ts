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

/** Bucket length of an intraday timeframe, or undefined (including for prototype keys like 'constructor'). */
export function intradayBucketMs(timeframe: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(INTRADAY_BUCKET_MS, timeframe) ? INTRADAY_BUCKET_MS[timeframe] : undefined;
}

/** Whether an intraday tick belongs to a bucket before `last`'s, which REST has already moved past. */
export function intradayTickBefore(last: OHLCVBar, timeframe: string, ms: number): boolean {
  const size = intradayBucketMs(timeframe);
  return size !== undefined && Math.floor(ms / size) * size < last.timestamp;
}

/**
 * The bucket a tick folds into, or null when it must not be folded. A 1Day `last`
 * must be stamped at its New York session day (e.g. ET midnight, as Alpaca does).
 */
export function bucketOf(last: OHLCVBar, timeframe: string, ms: number): number | null {
  const size = intradayBucketMs(timeframe);
  if (size !== undefined) return Math.floor(ms / size) * size;
  if (timeframe === '1Day') {
    // Daily bars are regular-session only, and the next day's bar comes from REST.
    const t = etDateFields(ms, NEW_YORK);
    const regular = t.minutesOfDay >= REGULAR_OPEN_MIN && t.minutesOfDay < REGULAR_CLOSE_MIN;
    return regular && t.dayKey === etDateFields(last.timestamp, NEW_YORK).dayKey ? last.timestamp : null;
  }
  return null;
}

function bucketBar(s: LiveBucketBar): LiveBucketBar {
  const { bucket, open, high, low, close, volume, tickVolume, tickHigh, tickLow } = s;
  return { bucket, open, high, low, close, volume, tickVolume, tickHigh, tickLow };
}

/**
 * Widens and re-closes REST's bar with the live bucket. Only traded extremes
 * widen it: a live open seeded from the previous close never traded in this
 * bucket, so it must not draw a wick on REST's bar. REST's volume may already
 * include the streamed trades, so volume is the larger of the two, never the sum.
 * Unchanged bars come back as-is.
 */
function mergeInto(rest: OHLCVBar, live: LiveBucketBar): OHLCVBar {
  const high = Math.max(rest.high, live.tickHigh);
  const low = Math.min(rest.low, live.tickLow);
  const volume = Math.max(rest.volume, live.tickVolume);
  if (rest.close === live.close && rest.high === high && rest.low === low && rest.volume === volume) return rest;
  return { ...rest, high, low, close: live.close, volume };
}

function liveBar(live: LiveBucketBar): OHLCVBar {
  const { bucket, open, high, low, close, volume } = live;
  return { timestamp: bucket, open, high, low, close, volume };
}

/**
 * Applies the closed buckets from index `from`, then `current`, to `bars`: the one
 * at REST's last bucket merges into it, later ones append. `bars` is copied at most
 * once, and comes back as the same array when nothing changes.
 */
function applyLive(bars: OHLCVBar[], closed: LiveBucketBar[], from: number, current: LiveBucketBar): OHLCVBar[] {
  const lastIdx = bars.length - 1;
  const last = bars[lastIdx];
  const total = closed.length + 1;
  const at = (k: number) => (k < closed.length ? closed[k] : current);
  let k = from;
  while (k < total && at(k).bucket < last.timestamp) k++;
  let out = bars;
  if (k < total && at(k).bucket === last.timestamp) {
    const merged = mergeInto(last, at(k));
    if (merged !== last) {
      out = bars.slice();
      out[lastIdx] = merged;
    }
    k++;
  }
  if (k < total) {
    if (out === bars) out = bars.slice();
    for (; k < total; k++) out.push(liveBar(at(k)));
  }
  return out;
}

/** Re-applies the live state (closed buckets REST lacks, then the forming one) to `bars`. */
export function mergeLive(bars: OHLCVBar[], state: LiveFoldState | null): OHLCVBar[] {
  if (state === null || bars.length === 0) return bars;
  // Where REST has a newer bar, its bar for a closed bucket is final.
  return applyLive(bars, state.closed, 0, state);
}

function unfolded(bars: OHLCVBar[], base: LiveFoldState | null) {
  return { bars: mergeLive(bars, base), state: base };
}

/**
 * Folds one tick into the live state and returns the bars with the live shape
 * applied. Each bucket keeps the high/low of every tick seen in it, so a spike's
 * wick survives the next tick and a REST refetch that lags the stream; the bucket
 * that just closed keeps its live shape until REST returns a newer bar.
 *
 * 1Day `bars` must be stamped at their New York session day (e.g. ET midnight, as
 * Alpaca does); a tick folds into the last daily bar only in that day's regular session.
 */
export function foldTick(
  prev: LiveFoldState | null,
  input: { key: string; bars: OHLCVBar[]; timeframe: string; tick: RealtimeTick },
): { bars: OHLCVBar[]; state: LiveFoldState | null } {
  const { key, bars, timeframe, tick } = input;
  const base = prev !== null && prev.key === key && prev.timeframe === timeframe ? prev : null;
  const ms = tickTimeMs(tick.time);
  const price = tick.price;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ms) || bars.length === 0) return unfolded(bars, base);
  if (base !== null && ms < base.lastTickMs) return unfolded(bars, base);
  const last = bars[bars.length - 1];
  const bucket = bucketOf(last, timeframe, ms);
  if (bucket === null || bucket < last.timestamp) return unfolded(bars, base);

  const sameBucket = base !== null && base.bucket === bucket;
  let closed: LiveBucketBar[] = [];
  if (sameBucket) closed = base.closed;
  else if (base !== null) {
    // Stored as a copy so `closed` holds plain bucket bars, not whole fold states.
    const grown = base.closed.concat(bucketBar(base));
    closed = grown.length > MAX_CLOSED ? grown.slice(-MAX_CLOSED) : grown;
  }
  // Closed buckets older than REST's last bar are kept, not pruned: applyLive skips
  // them, and a later refetch that ends earlier still needs them.

  // The bar the forming bucket follows: the newest live closed bucket at or after
  // REST's last bar (its close also wins when it merges into that bar), else REST's last.
  const newestClosed = closed.length > 0 ? closed[closed.length - 1] : null;
  const tailClose = newestClosed !== null && newestClosed.bucket >= last.timestamp ? newestClosed.close : last.close;
  // A bucket REST has not returned yet opens at the close of the bar before it.
  // One REST already has starts from that bar, so a later refetch that drops it
  // re-appends the live bucket without losing REST's open, extremes and volume.
  const covered = !sameBucket && bucket === last.timestamp;
  const size = typeof tick.size === 'number' && Number.isFinite(tick.size) && tick.size > 0 ? tick.size : 0;
  let open: number;
  let tickHigh: number;
  let tickLow: number;
  let tickVolume: number;
  // REST's volume for the bucket: the current bar when REST has it, else the last one seen.
  let restVolume: number;
  if (sameBucket) {
    open = base.open;
    tickHigh = Math.max(base.tickHigh, price);
    tickLow = Math.min(base.tickLow, price);
    tickVolume = base.tickVolume + size;
    restVolume = bucket === last.timestamp ? last.volume : base.volume;
  } else if (covered) {
    open = last.open;
    tickHigh = Math.max(last.high, price);
    tickLow = Math.min(last.low, price);
    tickVolume = size;
    restVolume = last.volume;
  } else {
    open = tailClose;
    tickHigh = price;
    tickLow = price;
    tickVolume = size;
    restVolume = 0;
  }
  const state: LiveFoldState = {
    key,
    timeframe,
    bucket,
    open,
    high: Math.max(open, tickHigh),
    low: Math.min(open, tickLow),
    close: price,
    volume: Math.max(restVolume, tickVolume),
    tickVolume,
    tickHigh,
    tickLow,
    lastTickMs: ms,
    closed,
  };
  return { bars: applyLive(bars, closed, 0, state), state };
}
