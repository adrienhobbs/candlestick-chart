import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OHLCVBar } from '../types/chart';
import { foldTick, intradayBucketMs, mergeLive, tickTimeMs } from './fold';
import { currentBucket, mergeGapBars, normalizeBars, tickGap, withGapBars } from './gap';
import { DEFAULT_STALL_AFTER_MS, deriveStreamState } from './live-state';
import type { GapRange, LiveConnection, LiveFoldState, LiveState, RealtimeTick } from './types';

export interface UseRealtimeBarsOptions {
  /** Series identity (the symbol). Null turns the hook off; a change resets all live state. */
  key: string | null;
  /** The host's REST history, refetched by the host as it likes. */
  bars: OHLCVBar[];
  timeframe: string;
  /** The latest tick. Pass a new object for each tick; the same object is not folded twice. */
  tick: RealtimeTick | null;
  connection: LiveConnection;
  /** Up/down color reference (e.g. previous close). Defaults to the last bar's open. */
  reference?: number | null;
  /** Backfills bars missed during a disconnect or a skipped bucket. Omit to turn gap-fill off. */
  fetchGap?: (range: GapRange) => Promise<OHLCVBar[]>;
  onGapError?: (err: unknown) => void;
  /** No tick for this long while open reads as `stalled`. Default DEFAULT_STALL_AFTER_MS (30 s). */
  stallAfterMs?: number;
}

export interface UseRealtimeBarsResult {
  bars: OHLCVBar[];
  live: LiveState | null;
}

const lastTimestamp = (bars: OHLCVBar[]) => (bars.length ? bars[bars.length - 1].timestamp : null);

/**
 * Folds host-pushed ticks into `bars` and describes the live price for the chart's
 * `live` prop. Ticks fold into refs as they arrive (so a burst loses no extreme)
 * and the output is published at most once per animation frame.
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

  const [frame, setFrame] = useState(0);
  const [gapVersion, setGapVersion] = useState(0);
  const [, setClock] = useState(0);

  const seriesRef = useRef<{ key: string | null; timeframe: string } | null>(null);
  const genRef = useRef(0);
  const foldRef = useRef<LiveFoldState | null>(null);
  const gapBarsRef = useRef<OHLCVBar[]>([]);
  const priceRef = useRef<number | null>(null);
  const lastTickMsRef = useRef<number | null>(null);
  const lastTickAtRef = useRef<number | null>(null);
  const tickSinceOpenRef = useRef(false);
  const seenTickRef = useRef<RealtimeTick | null>(null);
  // What the last published frame showed; renders between frames keep showing it.
  const shownRef = useRef<{ price: number | null; tickMs: number | null }>({ price: null, tickMs: null });
  const fetchingRef = useRef(false);
  const pendingGapRef = useRef(false);
  const frameIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const everOpenRef = useRef(false);
  const droppedRef = useRef(false);
  const fetchGapRef = useRef(fetchGap);
  fetchGapRef.current = fetchGap;
  const onGapErrorRef = useRef(onGapError);
  onGapErrorRef.current = onGapError;

  // A new series starts clean; gap responses for the old one are dropped by generation.
  if (seriesRef.current === null || seriesRef.current.key !== key || seriesRef.current.timeframe !== timeframe) {
    seriesRef.current = { key, timeframe };
    genRef.current += 1;
    foldRef.current = null;
    gapBarsRef.current = [];
    priceRef.current = null;
    lastTickMsRef.current = null;
    lastTickAtRef.current = null;
    tickSinceOpenRef.current = false;
    seenTickRef.current = null;
    shownRef.current = { price: null, tickMs: null };
    fetchingRef.current = false;
    pendingGapRef.current = false;
  }

  // gapVersion / frame stand in for the refs they publish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => withGapBars(bars, gapBarsRef.current), [bars, gapVersion, key, timeframe]);
  const merged = useMemo(
    () => (key === null ? bars : mergeLive(base, foldRef.current)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, frame, gapVersion, key],
  );

  const barsRef = useRef(bars);
  barsRef.current = bars;
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  // Read from refs, not the last published output: a gap response or a tick may have
  // landed since that frame.
  const currentBase = useCallback(() => withGapBars(barsRef.current, gapBarsRef.current), []);
  const newestKnown = useCallback((): number | null => {
    const rest = lastTimestamp(currentBase());
    const forming = foldRef.current?.bucket ?? null;
    if (rest === null) return forming;
    return forming === null ? rest : Math.max(rest, forming);
  }, [currentBase]);

  const scheduleFrame = useCallback(() => {
    if (frameIdRef.current !== null) return;
    frameIdRef.current = requestAnimationFrame(() => {
      frameIdRef.current = null;
      if (!mountedRef.current) return;
      shownRef.current = { price: priceRef.current, tickMs: lastTickMsRef.current };
      setFrame((f) => f + 1);
    });
  }, []);

  const requestGapRef = useRef<(range: GapRange) => void>(() => undefined);
  const requestGap = useCallback((range: GapRange) => {
    const fetcher = fetchGapRef.current;
    if (!fetcher) return;
    if (fetchingRef.current) {
      pendingGapRef.current = true;
      return;
    }
    fetchingRef.current = true;
    const gen = genRef.current;
    const current = () => mountedRef.current && gen === genRef.current;
    fetcher(range)
      .then(
        (fetched) => {
          if (!current()) return;
          const clean = normalizeBars(fetched);
          gapBarsRef.current = mergeGapBars(gapBarsRef.current, clean);
          const state = foldRef.current;
          if (state) {
            // A fetched bar is final for a closed bucket.
            const fetchedTimes = new Set(clean.map((b) => b.timestamp));
            foldRef.current = { ...state, closed: state.closed.filter((c) => !fetchedTimes.has(c.bucket)) };
          }
          setGapVersion((v) => v + 1);
        },
        (err: unknown) => {
          if (current()) onGapErrorRef.current?.(err);
        },
      )
      .finally(() => {
        if (!current()) return;
        fetchingRef.current = false;
        if (!pendingGapRef.current) return;
        pendingGapRef.current = false;
        const again = tickGap(newestKnown(), timeframeRef.current, Date.now());
        if (again) requestGapRef.current(again);
      });
  }, [newestKnown]);
  requestGapRef.current = requestGap;

  useEffect(() => {
    if (key === null || tick === null || tick === seenTickRef.current) return;
    seenTickRef.current = tick;
    const ms = tickTimeMs(tick.time);
    // Same rejects as foldTick, so a price it would not fold never shows as the live price.
    if (!Number.isFinite(tick.price) || tick.price <= 0 || !Number.isFinite(ms)) return;
    if (lastTickMsRef.current !== null && ms < lastTickMsRef.current) return;
    lastTickMsRef.current = ms;
    priceRef.current = tick.price;
    lastTickAtRef.current = Date.now();
    tickSinceOpenRef.current = true;
    const gap = tickGap(newestKnown(), timeframe, ms);
    foldRef.current = foldTick(foldRef.current, { key, bars: currentBase(), timeframe, tick }).state;
    if (gap) requestGap(gap);
    scheduleFrame();
  }, [tick, key, timeframe, requestGap, scheduleFrame, newestKnown, currentBase]);

  useEffect(() => {
    if (connection !== 'open') {
      tickSinceOpenRef.current = false;
      if (connection === 'closed' && everOpenRef.current) droppedRef.current = true;
      return;
    }
    everOpenRef.current = true;
    if (!droppedRef.current || key === null) return;
    droppedRef.current = false;
    const newest = newestKnown();
    if (newest !== null) requestGap({ fromMs: newest, toMs: currentBucket(timeframe, Date.now()) });
  }, [connection, key, timeframe, requestGap, newestKnown]);

  useEffect(() => {
    const at = lastTickAtRef.current;
    if (connection !== 'open' || at === null) return;
    const after = Number.isFinite(stallAfterMs) && stallAfterMs > 0 ? stallAfterMs : DEFAULT_STALL_AFTER_MS;
    const id = setTimeout(() => setClock((c) => c + 1), Math.max(0, at + after - Date.now()));
    return () => clearTimeout(id);
  }, [frame, connection, stallAfterMs, key]);

  useEffect(() => {
    mountedRef.current = true;
    // A pending frame is not cancelled here: StrictMode's mount-unmount-mount
    // would drop it, and the callback already checks mountedRef.
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const size = intradayBucketMs(timeframe);
  const { price, tickMs } = key === null ? { price: null, tickMs: null } : shownRef.current;
  const barCloseAt = size !== undefined && tickMs !== null ? Math.floor(tickMs / size) * size + size : null;
  const lastBar = merged.length ? merged[merged.length - 1] : null;
  const ref = reference ?? lastBar?.open ?? price;
  const stream = deriveStreamState({
    connection,
    tickSinceOpen: tickSinceOpenRef.current,
    lastTickAt: lastTickAtRef.current,
    now: Date.now(),
    stallAfterMs,
  });
  const live = useMemo<LiveState | null>(
    () => (price === null || ref === null ? null : { price, reference: ref, barCloseAt, state: stream }),
    [price, ref, barCloseAt, stream],
  );
  return useMemo(() => ({ bars: merged, live }), [merged, live]);
}
