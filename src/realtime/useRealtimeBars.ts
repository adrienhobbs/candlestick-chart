import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OHLCVBar } from '../types/chart';
import { foldTick, intradayBucketMs, mergeLive, tickTimeMs } from './fold';
import { currentBucket, mergeGapBars, normalizeBars, tickGap, withGapBars } from './gap';
import { DEFAULT_STALL_AFTER_MS, deriveStreamState } from './live-state';
import type { GapRange, LiveBucketBar, LiveConnection, LiveFoldState, LiveState, RealtimeTick } from './types';

export interface GapFetchOptions {
  /** Aborted once the response would be dropped: the key or timeframe changed, or the hook unmounted. */
  signal: AbortSignal;
}

export interface UseRealtimeBarsOptions {
  /** Series identity (the symbol). Null turns the hook off; a change resets all live state. */
  key: string | null;
  /** The host's REST history, refetched by the host as it likes. */
  bars: OHLCVBar[];
  timeframe: string;
  /**
   * The latest tick. Pass a new object for each tick; the same object is not folded twice.
   * The tick passed in the render that changes `key` is taken to belong to the previous key
   * and is not folded.
   */
  tick: RealtimeTick | null;
  connection: LiveConnection;
  /** Up/down color reference (e.g. previous close). Defaults to the last bar's open. */
  reference?: number | null;
  /**
   * Backfills bars missed during a disconnect or a skipped bucket. Omit to turn gap-fill off.
   * One request runs at a time; pass `options.signal` to your fetch to cancel dropped ones.
   * Must resolve to an array of bars; anything else, or a rejection, goes to `onGapError`.
   */
  fetchGap?: (range: GapRange, options: GapFetchOptions) => Promise<OHLCVBar[]>;
  onGapError?: (err: unknown) => void;
  /** No tick for this long while open reads as `stalled`. Default DEFAULT_STALL_AFTER_MS (30 s). */
  stallAfterMs?: number;
}

export interface UseRealtimeBarsResult {
  bars: OHLCVBar[];
  live: LiveState | null;
}

/** What one animation frame showed; renders between frames keep showing it. */
interface Published {
  fold: LiveFoldState | null;
  gapBars: OHLCVBar[];
  price: number | null;
  tickMs: number | null;
}

/** All live state for one key + timeframe. Replaced, never reset, so a stale closure can only touch its own. */
interface Series {
  key: string | null;
  timeframe: string;
  fold: LiveFoldState | null;
  gapBars: OHLCVBar[];
  price: number | null;
  lastTickMs: number | null;
  /** Wall-clock time the last tick arrived. */
  lastTickAt: number | null;
  tickSinceOpen: boolean;
  seenTick: RealtimeTick | null;
  published: Published;
  inflight: AbortController | null;
  /** Ranges asked for while a request was in flight, as one span. */
  pending: GapRange | null;
  dropped: boolean;
  /** Newest bar known when the stream left `open`; the reconnect backfills from here. */
  droppedFromMs: number | null;
}

type SeriesView = Pick<Series, 'published' | 'lastTickAt' | 'tickSinceOpen'>;

const NOTHING_PUBLISHED: Published = { fold: null, gapBars: [], price: null, tickMs: null };
const EMPTY_VIEW: SeriesView = { published: NOTHING_PUBLISHED, lastTickAt: null, tickSinceOpen: false };

function newSeries(key: string | null, timeframe: string, seenTick: RealtimeTick | null, dropped: boolean): Series {
  return {
    key,
    timeframe,
    fold: null,
    gapBars: [],
    price: null,
    lastTickMs: null,
    lastTickAt: null,
    tickSinceOpen: false,
    seenTick,
    published: NOTHING_PUBLISHED,
    inflight: null,
    pending: null,
    dropped,
    droppedFromMs: null,
  };
}

const lastTimestamp = (bars: OHLCVBar[]) => (bars.length ? bars[bars.length - 1].timestamp : null);

const unionRange = (a: GapRange | null, b: GapRange): GapRange =>
  a === null ? b : { fromMs: Math.min(a.fromMs, b.fromMs), toMs: Math.max(a.toMs, b.toMs) };

function liveBucketAt(state: LiveFoldState | null, bucket: number): LiveBucketBar | null {
  if (state === null) return null;
  if (state.bucket === bucket) return state;
  return state.closed.find((c) => c.bucket === bucket) ?? null;
}

function newestKnown(series: Series, hostBars: OHLCVBar[]): number | null {
  const rest = lastTimestamp(withGapBars(hostBars, series.gapBars));
  const forming = series.fold?.bucket ?? null;
  if (rest === null) return forming;
  return forming === null ? rest : Math.max(rest, forming);
}

/**
 * Stores a gap response. A fetched bar is final only for a bucket that had closed
 * before the request went out; it then replaces the live closed bucket. A bucket
 * still forming at request time may have traded past the fetched bar, so the bar
 * keeps the live extremes, volume and close.
 */
function applyGapResponse(series: Series, fetched: OHLCVBar[], requestedAt: number): void {
  const size = intradayBucketMs(series.timeframe);
  const finalBuckets = new Set<number>();
  const bars = normalizeBars(fetched).map((b) => {
    if (size !== undefined && b.timestamp + size <= requestedAt) {
      finalBuckets.add(b.timestamp);
      return b;
    }
    const live = liveBucketAt(series.fold, b.timestamp);
    if (live === null) return b;
    return {
      ...b,
      high: Math.max(b.high, live.tickHigh),
      low: Math.min(b.low, live.tickLow),
      close: live.close,
      volume: Math.max(b.volume, live.volume),
    };
  });
  series.gapBars = mergeGapBars(series.gapBars, bars);
  const fold = series.fold;
  if (fold !== null && fold.closed.some((c) => finalBuckets.has(c.bucket))) {
    series.fold = { ...fold, closed: fold.closed.filter((c) => !finalBuckets.has(c.bucket)) };
  }
}

/**
 * Folds host-pushed ticks into `bars` and describes the live price for the chart's
 * `live` prop. Ticks fold into the series state as they arrive (so a burst loses no
 * extreme) and the output is published at most once per animation frame, from a
 * snapshot taken in that frame, so bars and price always come from the same moment.
 */
export function useRealtimeBars(options: UseRealtimeBarsOptions): UseRealtimeBarsResult {
  const {
    key,
    bars,
    timeframe,
    tick,
    connection,
    reference = null,
    fetchGap,
    onGapError,
    stallAfterMs = DEFAULT_STALL_AFTER_MS,
  } = options;

  const [publishTick, setPublishTick] = useState(0);
  const [clock, setClock] = useState(0);

  const seriesRef = useRef<Series | null>(null);
  const latestRef = useRef({ bars, fetchGap, onGapError, connection });
  const frameIdRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const everOpenRef = useRef(false);

  useLayoutEffect(() => {
    latestRef.current = { bars, fetchGap, onGapError, connection };
  });

  // Series changes happen in a layout effect, not during render, so a render React
  // discards cannot reset anything. Until it runs, the render shows an empty series.
  useLayoutEffect(() => {
    const prev = seriesRef.current;
    if (prev !== null && prev.key === key && prev.timeframe === timeframe) return;
    prev?.inflight?.abort();
    // The tick passed alongside a new key is the old key's last tick; a timeframe
    // change on the same key refolds it into the new buckets.
    const seen = prev !== null && prev.key !== key ? tick : null;
    const dropped = everOpenRef.current && latestRef.current.connection !== 'open';
    seriesRef.current = newSeries(key, timeframe, seen, dropped);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a series change reads the tick
  }, [key, timeframe]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // StrictMode remounts synchronously, so this only aborts on a real unmount.
      queueMicrotask(() => {
        if (!mountedRef.current) seriesRef.current?.inflight?.abort();
      });
    };
  }, []);

  const scheduleFrame = useCallback(() => {
    if (frameIdRef.current !== null) return;
    frameIdRef.current = requestAnimationFrame(() => {
      frameIdRef.current = null;
      const s = seriesRef.current;
      if (!mountedRef.current || s === null) return;
      s.published = { fold: s.fold, gapBars: s.gapBars, price: s.price, tickMs: s.lastTickMs };
      setPublishTick((n) => n + 1);
    });
  }, []);

  const requestGap = useCallback(
    function request(s: Series, range: GapRange): void {
      const fetcher = latestRef.current.fetchGap;
      if (!fetcher) return;
      if (s.inflight !== null) {
        s.pending = unionRange(s.pending, range);
        return;
      }
      const controller = new AbortController();
      s.inflight = controller;
      const requestedAt = Date.now();
      const current = () => mountedRef.current && seriesRef.current === s && !controller.signal.aborted;
      let response: Promise<OHLCVBar[]>;
      try {
        response = Promise.resolve(fetcher(range, { signal: controller.signal }));
      } catch (err) {
        response = Promise.reject(err);
      }
      response
        .then((fetched) => {
          if (!current()) return;
          if (!Array.isArray(fetched)) throw new TypeError('fetchGap must resolve to an array of bars');
          applyGapResponse(s, fetched, requestedAt);
          scheduleFrame();
        })
        .catch((err: unknown) => {
          if (current()) latestRef.current.onGapError?.(err);
        })
        .finally(() => {
          if (s.inflight === controller) s.inflight = null;
          if (!current()) return;
          const next = s.pending;
          s.pending = null;
          if (next !== null) request(s, next);
        });
    },
    [scheduleFrame],
  );

  useEffect(() => {
    const s = seriesRef.current;
    if (key === null || tick === null || s === null || s.key !== key || s.timeframe !== timeframe) return;
    if (tick === s.seenTick) return;
    s.seenTick = tick;
    const ms = tickTimeMs(tick.time);
    // Same rejects as foldTick, so a price it would not fold never shows as the live price.
    if (!Number.isFinite(tick.price) || tick.price <= 0 || !Number.isFinite(ms)) return;
    if (s.lastTickMs !== null && ms < s.lastTickMs) return;
    s.lastTickMs = ms;
    s.price = tick.price;
    s.lastTickAt = Date.now();
    s.tickSinceOpen = true;
    const hostBars = latestRef.current.bars;
    const gap = tickGap(newestKnown(s, hostBars), timeframe, ms);
    s.fold = foldTick(s.fold, { key, bars: withGapBars(hostBars, s.gapBars), timeframe, tick }).state;
    if (gap) requestGap(s, gap);
    scheduleFrame();
  }, [tick, key, timeframe, requestGap, scheduleFrame]);

  useEffect(() => {
    const s = seriesRef.current;
    if (s === null) return;
    if (connection !== 'open') {
      s.tickSinceOpen = false;
      if (everOpenRef.current && !s.dropped) {
        s.dropped = true;
        s.droppedFromMs = newestKnown(s, latestRef.current.bars);
      }
      return;
    }
    everOpenRef.current = true;
    if (!s.dropped) return;
    s.dropped = false;
    const fromMs = s.droppedFromMs ?? newestKnown(s, latestRef.current.bars);
    s.droppedFromMs = null;
    if (key === null || fromMs === null) return;
    // The tick clock can run ahead of this one, so the range never ends before it starts.
    requestGap(s, { fromMs, toMs: Math.max(fromMs, currentBucket(timeframe, Date.now())) });
  }, [connection, key, timeframe, requestGap]);

  // Gap bars the host now has are dead weight: withGapBars would never show them.
  useEffect(() => {
    const s = seriesRef.current;
    const lastTs = lastTimestamp(bars);
    if (s === null || lastTs === null || s.gapBars.length === 0) return;
    if (s.gapBars[0].timestamp <= lastTs) s.gapBars = s.gapBars.filter((b) => b.timestamp > lastTs);
  }, [bars]);

  const current = seriesRef.current;
  const view: SeriesView = current !== null && current.key === key && current.timeframe === timeframe ? current : EMPTY_VIEW;
  const { published } = view;

  const merged = useMemo(
    () => (key === null ? bars : mergeLive(withGapBars(bars, published.gapBars), published.fold)),
    [bars, key, published],
  );

  const stallMs = Number.isFinite(stallAfterMs) && stallAfterMs > 0 ? stallAfterMs : DEFAULT_STALL_AFTER_MS;
  const stream = deriveStreamState({
    connection,
    tickSinceOpen: view.tickSinceOpen,
    lastTickAt: view.lastTickAt,
    now: Date.now(),
    stallAfterMs: stallMs,
  });

  // Re-checks the stall deadline from the latest tick's arrival time whenever the
  // clock fires or a tick arrives, so neither paused frames nor a timer that fires a
  // little early can leave the state stuck at `live`.
  useEffect(() => {
    const at = view.lastTickAt;
    if (connection !== 'open' || !view.tickSinceOpen || at === null) return;
    const remaining = at + stallMs - Date.now();
    const due: typeof stream = remaining > 0 ? 'live' : 'stalled';
    if (due !== stream) {
      setClock((c) => c + 1);
      return;
    }
    if (due === 'stalled') return;
    const id = setTimeout(() => setClock((c) => c + 1), remaining);
    return () => clearTimeout(id);
  }, [view, tick, publishTick, clock, connection, stallMs, stream]);

  const { price, tickMs } = key === null ? NOTHING_PUBLISHED : published;
  const size = intradayBucketMs(timeframe);
  const barCloseAt = size !== undefined && tickMs !== null ? Math.floor(tickMs / size) * size + size : null;
  const lastBar = merged.length ? merged[merged.length - 1] : null;
  const referencePrice = reference ?? lastBar?.open ?? price;
  const live = useMemo<LiveState | null>(
    () =>
      price === null || referencePrice === null
        ? null
        : { price, reference: referencePrice, barCloseAt, state: stream },
    [price, referencePrice, barCloseAt, stream],
  );
  return useMemo(() => ({ bars: merged, live }), [merged, live]);
}
