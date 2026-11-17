import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OHLCVBar } from '../types/chart';
import { foldTick, intradayBucketMs, mergeLive, tickTimeMs } from './fold';
import { currentBucket, mergeGapBars, normalizeBars, tickGap, withGapBars } from './gap';
import { DEFAULT_STALL_AFTER_MS, deriveStreamState } from './live-state';
import type {
  GapRange,
  LiveBucketBar,
  LiveConnection,
  LiveFoldState,
  LiveState,
  LiveStreamState,
  RealtimeTick,
} from './types';

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
   * The latest tick, for simple hosts; streaming hosts should call `pushTick` instead.
   * Only the tick present at each render is folded, so when React batches several tick
   * updates into one render the intermediate ticks (and their highs and lows) are lost.
   * Pass a new object for each tick; the same object is not folded twice. The tick passed
   * in the render that changes `key` is taken to belong to the previous key and is not folded.
   */
  tick?: RealtimeTick | null;
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
  /**
   * Folds one tick, or several in order, into the current series right away and
   * schedules one publish per animation frame. The preferred entry point for streaming
   * hosts: call it from the socket handler, outside React, for every tick. The same
   * function for the hook's lifetime. Ignored while `key` is null and after unmount.
   */
  pushTick: (tick: RealtimeTick | readonly RealtimeTick[]) => void;
}

/**
 * Gap bars kept per series. Every session open after a night or weekend backfills a
 * gap, so a chart left open for weeks would otherwise grow them without bound; the
 * host's REST history covers anything older.
 */
export const MAX_GAP_BARS = 2000;

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
  /** The newest tick folded; a timeframe change refolds it into the new series. */
  lastTick: RealtimeTick | null;
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
    lastTick: null,
    published: NOTHING_PUBLISHED,
    inflight: null,
    pending: null,
    dropped,
    droppedFromMs: null,
  };
}

const isTickList = (input: RealtimeTick | readonly RealtimeTick[]): input is readonly RealtimeTick[] =>
  Array.isArray(input);

const unionRange = (a: GapRange | null, b: GapRange): GapRange =>
  a === null ? b : { fromMs: Math.min(a.fromMs, b.fromMs), toMs: Math.max(a.toMs, b.toMs) };

function liveBucketAt(state: LiveFoldState | null, bucket: number): LiveBucketBar | null {
  if (state === null) return null;
  if (state.bucket === bucket) return state;
  return state.closed.find((c) => c.bucket === bucket) ?? null;
}

/** The last bar of withGapBars(hostBars, gapBars), without building it. */
function lastBaseBar(hostBars: OHLCVBar[], gapBars: OHLCVBar[]): OHLCVBar | null {
  const host = hostBars.length ? hostBars[hostBars.length - 1] : null;
  const gap = gapBars.length ? gapBars[gapBars.length - 1] : null;
  return gap !== null && (host === null || gap.timestamp > host.timestamp) ? gap : host;
}

function newestKnown(series: Series, hostBars: OHLCVBar[]): number | null {
  const rest = lastBaseBar(hostBars, series.gapBars)?.timestamp ?? null;
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
      volume: Math.max(b.volume, live.tickVolume),
    };
  });
  const gapBars = mergeGapBars(series.gapBars, bars);
  series.gapBars = gapBars.length > MAX_GAP_BARS ? gapBars.slice(-MAX_GAP_BARS) : gapBars;
  const fold = series.fold;
  if (fold !== null && fold.closed.some((c) => finalBuckets.has(c.bucket))) {
    series.fold = { ...fold, closed: fold.closed.filter((c) => !finalBuckets.has(c.bucket)) };
  }
}

/**
 * Folds streamed ticks into `bars` and describes the live price for the chart's
 * `live` prop. Streaming hosts should feed ticks through the returned `pushTick`;
 * the `tick` option folds only the tick present at each render, so batched updates
 * can lose intermediate ticks.
 *
 * In a hidden tab, where animation frames pause, `live.state` can change before
 * `live.price` and `bars` do: the state reads the live series, while price and bars
 * come from the last frame's snapshot. A child's layout effect that calls `pushTick`
 * during the commit that changes `key` runs before this hook's series change, so its
 * tick may land in the old series (pass `tick.key` to have it dropped instead). Ticks fold into the series state as they arrive (so a burst loses no
 * extreme) and the output is published at most once per animation frame, from a
 * snapshot taken in that frame, so bars and price always come from the same moment.
 */
export function useRealtimeBars(options: UseRealtimeBarsOptions): UseRealtimeBarsResult {
  const {
    key,
    bars,
    timeframe,
    tick = null,
    connection,
    reference = null,
    fetchGap,
    onGapError,
    stallAfterMs = DEFAULT_STALL_AFTER_MS,
  } = options;

  const [, setPublishTick] = useState(0);
  const [, setClock] = useState(0);
  const stallMs = Number.isFinite(stallAfterMs) && stallAfterMs > 0 ? stallAfterMs : DEFAULT_STALL_AFTER_MS;

  const seriesRef = useRef<Series | null>(null);
  const latestRef = useRef({ bars, fetchGap, onGapError, connection, stallMs });
  const frameIdRef = useRef<number | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const everOpenRef = useRef(false);
  // The stream state the last committed render showed.
  const shownStreamRef = useRef<LiveStreamState>('connecting');

  useLayoutEffect(() => {
    latestRef.current = { bars, fetchGap, onGapError, connection, stallMs };
  });

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

  // One timer, re-armed from the latest tick's arrival time each time it fires, so
  // ticks need not render and a timer that fires a little early just waits again.
  const armStall = useCallback(function arm(): void {
    if (stallTimerRef.current !== null || !mountedRef.current) return;
    const s = seriesRef.current;
    const { connection: conn, stallMs: after } = latestRef.current;
    if (s === null || s.lastTickAt === null || conn !== 'open') return;
    const remaining = s.lastTickAt + after - Date.now();
    if (remaining > 0) {
      stallTimerRef.current = setTimeout(() => {
        stallTimerRef.current = null;
        arm();
      }, remaining);
    } else if (shownStreamRef.current === 'live') {
      setClock((c) => c + 1);
    }
  }, []);

  const clearStall = useCallback(() => {
    if (stallTimerRef.current !== null) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = null;
  }, []);

  useLayoutEffect(() => {
    mountedRef.current = true;
    armStall();
    return () => {
      mountedRef.current = false;
      clearStall();
      // StrictMode remounts synchronously, so this only aborts on a real unmount.
      queueMicrotask(() => {
        if (!mountedRef.current) seriesRef.current?.inflight?.abort();
      });
    };
  }, [armStall, clearStall]);

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

  /** The one fold path for both the tick prop and pushTick. */
  const ingest = useCallback(
    (s: Series, ticks: readonly RealtimeTick[]): void => {
      const key = s.key;
      if (key === null) return;
      let folded = false;
      const { bars: hostBars, connection: conn } = latestRef.current;
      for (const t of ticks) {
        if (typeof t !== 'object' || t === null) continue;
        if (t.key !== undefined && t.key !== key) continue;
        const ms = tickTimeMs(t.time);
        // Same rejects as foldTick, so a price it would not fold never shows as the live price.
        if (!Number.isFinite(t.price) || t.price <= 0 || !Number.isFinite(ms)) continue;
        if (s.lastTickMs !== null && ms < s.lastTickMs) continue;
        s.lastTickMs = ms;
        s.lastTick = t;
        s.price = t.price;
        s.lastTickAt = Date.now();
        // A tick from before the stream opened does not make it live.
        if (conn === 'open') s.tickSinceOpen = true;
        const gap = tickGap(newestKnown(s, hostBars), s.timeframe, ms);
        // foldTick's state depends only on the last bar, so the full history is not
        // built per tick; its returned bars are not used.
        const tail = lastBaseBar(hostBars, s.gapBars);
        s.fold = foldTick(s.fold, { key, bars: tail === null ? [] : [tail], timeframe: s.timeframe, tick: t }).state;
        if (gap) requestGap(s, gap);
        folded = true;
      }
      if (!folded) return;
      scheduleFrame();
      armStall();
      // Frames may be paused (hidden tab), so a stall that just ended needs its own render.
      if (shownStreamRef.current === 'stalled') setClock((c) => c + 1);
    },
    [requestGap, scheduleFrame, armStall],
  );

  // Series changes happen in a layout effect, not during render, so a render React
  // discards cannot reset anything. Until it runs, the render shows an empty series.
  useLayoutEffect(() => {
    const prev = seriesRef.current;
    if (prev !== null && prev.key === key && prev.timeframe === timeframe) return;
    prev?.inflight?.abort();
    const sameKey = prev !== null && prev.key === key;
    // The tick passed alongside a new key is the old key's last tick, so it is marked
    // seen. On a timeframe change the previous series' last tick is refolded into the
    // new buckets, and marked seen so the tick prop does not fold it a second time.
    const carried = sameKey ? prev.lastTick : null;
    const seen = prev === null ? null : sameKey ? carried : tick;
    const dropped = everOpenRef.current && latestRef.current.connection !== 'open';
    const next = newSeries(key, timeframe, seen, dropped);
    seriesRef.current = next;
    if (carried !== null) ingest(next, [carried]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a series change reads the tick
  }, [key, timeframe]);

  const pushTick = useCallback(
    (input: RealtimeTick | readonly RealtimeTick[]) => {
      const s = seriesRef.current;
      if (!mountedRef.current || s === null) return;
      ingest(s, isTickList(input) ? input : [input]);
    },
    [ingest],
  );

  useEffect(() => {
    const s = seriesRef.current;
    if (key === null || tick === null || s === null || s.key !== key || s.timeframe !== timeframe) return;
    if (tick === s.seenTick) return;
    s.seenTick = tick;
    ingest(s, [tick]);
  }, [tick, key, timeframe, ingest]);

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

  const current = seriesRef.current;
  const view: SeriesView = current !== null && current.key === key && current.timeframe === timeframe ? current : EMPTY_VIEW;
  const { published } = view;

  const merged = useMemo(
    () => (key === null ? bars : mergeLive(withGapBars(bars, published.gapBars), published.fold)),
    [bars, key, published],
  );

  const stream = deriveStreamState({
    connection,
    tickSinceOpen: view.tickSinceOpen,
    lastTickAt: view.lastTickAt,
    now: Date.now(),
    stallAfterMs: stallMs,
  });

  useLayoutEffect(() => {
    shownStreamRef.current = stream;
  });

  // A new connection state, threshold or series re-times the stall check.
  useEffect(() => {
    clearStall();
    armStall();
  }, [connection, stallMs, view, armStall, clearStall]);

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
  return useMemo(() => ({ bars: merged, live, pushTick }), [merged, live, pushTick]);
}
