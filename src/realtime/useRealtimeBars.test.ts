import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode, createElement, type ReactNode } from 'react';
import type { OHLCVBar } from '../types/chart';
import { useRealtimeBars, type GapFetchOptions, type UseRealtimeBarsOptions } from './useRealtimeBars';
import type { GapRange, RealtimeTick } from './types';

const T0 = Date.parse('2026-10-30T16:25:00Z');
const REST: OHLCVBar[] = [
  { timestamp: T0 - 300_000, open: 99, high: 100.1, low: 98.9, close: 100, volume: 5 },
  { timestamp: T0, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 },
];
const tick = (price: number, s: number, size?: number): RealtimeTick => ({ price, time: T0 + s * 1000, size });
const opts = (over: Partial<UseRealtimeBarsOptions> = {}): UseRealtimeBarsOptions => ({
  key: 'XYZ',
  bars: REST,
  timeframe: '5Min',
  tick: null,
  connection: 'open',
  ...over,
});
const lastOf = (bars: OHLCVBar[]) => bars[bars.length - 1];
const bar = (s: number, close: number, over: Partial<OHLCVBar> = {}): OHLCVBar => ({
  timestamp: T0 + s * 1000,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
  ...over,
});
const withSignal = { signal: expect.any(AbortSignal) };

/** A fetchGap whose calls each resolve or reject when the test says so. */
function controlledFetch() {
  const calls: { range: GapRange; signal: AbortSignal; resolve: (b: unknown) => void; reject: (e: unknown) => void }[] = [];
  const fetchGap = vi.fn(
    (range: GapRange, options: GapFetchOptions) =>
      new Promise<OHLCVBar[]>((resolve, reject) => {
        calls.push({ range, signal: options.signal, resolve: resolve as (b: unknown) => void, reject });
      }),
  );
  return { fetchGap, calls };
}

let frames: FrameRequestCallback[] = [];
const flushFrame = () =>
  act(() => {
    const due = frames;
    frames = [];
    due.forEach((f) => f(0));
  });

/** Lets fetchGap's then/finally chain run. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function setup(initial: UseRealtimeBarsOptions, wrapper?: (p: { children: ReactNode }) => ReactNode) {
  return renderHook((p: UseRealtimeBarsOptions) => useRealtimeBars(p), { initialProps: initial, wrapper });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(T0 + 10_000);
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useRealtimeBars', () => {
  it('is off with a null key', () => {
    const h = setup(opts({ key: null, tick: tick(101, 10) }));
    expect(h.result.current.bars).toBe(REST);
    expect(h.result.current.live).toBeNull();
  });

  it('publishes a burst of ticks once per frame, keeping its extremes', () => {
    const h = setup(opts());
    const before = h.result.current.bars;
    for (let i = 0; i < 100; i += 1) {
      const price = i === 40 ? 101.5 : i === 60 ? 99 : i === 99 ? 100.3 : 100.1;
      h.rerender(opts({ tick: tick(price, 20 + i / 100) }));
    }
    expect(h.result.current.bars).toBe(before);
    flushFrame();
    const last = lastOf(h.result.current.bars);
    expect({ high: last.high, low: last.low, close: last.close }).toEqual({ high: 101.5, low: 99, close: 100.3 });
    expect(h.result.current.live?.price).toBe(100.3);
    const published = h.result.current.bars;
    flushFrame();
    expect(h.result.current.bars).toBe(published);
  });

  it('returns the same output on unrelated renders', () => {
    const t = tick(100.9, 10);
    const h = setup(opts({ tick: t }));
    flushFrame();
    const out = h.result.current;
    h.rerender(opts({ tick: t }));
    expect(h.result.current).toBe(out);
  });

  it('keeps showing the last frame when the host renders between frames', () => {
    const h = setup(opts({ tick: tick(100.9, 10) }));
    flushFrame();
    const shown = h.result.current;
    h.rerender(opts({ tick: tick(101.4, 20) }));
    expect(h.result.current).toBe(shown);
    const refetched = REST.map((b) => ({ ...b }));
    h.rerender(opts({ bars: refetched, tick: tick(101.4, 20) }));
    const afterRefetch = h.result.current.bars;
    expect(afterRefetch).not.toBe(shown.bars);
    expect(lastOf(afterRefetch).close).toBe(100.9);
    expect(h.result.current.live?.price).toBe(100.9);
    h.rerender(opts({ bars: refetched, tick: tick(101.4, 20) }));
    expect(h.result.current.bars).toBe(afterRefetch);
    flushFrame();
    expect(lastOf(h.result.current.bars).close).toBe(101.4);
    expect(h.result.current.live?.price).toBe(101.4);
  });

  it('shows the live price before any REST bars arrive', () => {
    const h = setup(opts({ bars: [], tick: tick(100.3, 10) }));
    flushFrame();
    expect(h.result.current.bars).toEqual([]);
    expect(h.result.current.live?.price).toBe(100.3);
  });

  it('reports connecting, live, stalled and disconnected', () => {
    const h = setup(opts({ connection: 'connecting' }));
    expect(h.result.current.live).toBeNull();
    const t = tick(100.3, 10);
    h.rerender(opts({ connection: 'open', tick: t }));
    flushFrame();
    expect(h.result.current.live?.state).toBe('live');
    advance(30_000);
    expect(h.result.current.live?.state).toBe('stalled');
    h.rerender(opts({ connection: 'closed', tick: t }));
    expect(h.result.current.live?.state).toBe('disconnected');
    h.rerender(opts({ connection: 'open', tick: t }));
    expect(h.result.current.live?.state).toBe('connecting');
    h.rerender(opts({ connection: 'open', tick: tick(100.4, 40) }));
    flushFrame();
    expect(h.result.current.live?.state).toBe('live');
  });

  it('detects a stall when ticks keep arriving but frames do not', () => {
    const h = setup(opts({ tick: tick(100.3, 10) }));
    flushFrame();
    advance(20_000);
    h.rerender(opts({ tick: tick(100.4, 30) }));
    advance(10_000);
    expect(h.result.current.live?.state).toBe('live');
    advance(60_000);
    expect(h.result.current.live?.state).toBe('stalled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('re-arms the stall timer when it fires before the clock reaches the deadline', () => {
    const h = setup(opts({ tick: tick(100.3, 10) }));
    flushFrame();
    const fakeNow = Date.now;
    const behind = vi.spyOn(Date, 'now').mockImplementation(() => fakeNow.call(Date) - 5);
    advance(30_000);
    expect(h.result.current.live?.state).toBe('live');
    behind.mockRestore();
    advance(5);
    expect(h.result.current.live?.state).toBe('stalled');
  });

  it('sets price, reference and bar close', () => {
    const h = setup(opts({ tick: tick(100.3, 10) }));
    flushFrame();
    expect(h.result.current.live).toMatchObject({ price: 100.3, reference: 100, barCloseAt: T0 + 300_000 });
    h.rerender(opts({ tick: tick(100.3, 10), reference: 99 }));
    expect(h.result.current.live?.reference).toBe(99);
    const daily = setup(opts({ timeframe: '1Day', bars: [{ ...REST[1], timestamp: Date.parse('2026-10-30T04:00:00Z') }], tick: { price: 100.3, time: '2026-10-30T16:00:00Z' } }));
    flushFrame();
    expect(daily.result.current.live?.barCloseAt).toBeNull();
  });

  it('moves the live price but not the bars for a 1Day pre-market tick', () => {
    const daily: OHLCVBar[] = [{ ...REST[1], timestamp: Date.parse('2026-10-30T04:00:00Z') }];
    const h = setup(opts({ timeframe: '1Day', bars: daily, tick: { price: 120, time: '2026-10-30T12:00:00Z' } }));
    flushFrame();
    expect(h.result.current.live?.price).toBe(120);
    expect(h.result.current.bars).toBe(daily);
  });

  it('ignores a tick older than the last one', () => {
    const h = setup(opts({ tick: tick(100.9, 20) }));
    flushFrame();
    h.rerender(opts({ tick: tick(100.1, 10) }));
    flushFrame();
    expect(h.result.current.live?.price).toBe(100.9);
    expect(lastOf(h.result.current.bars).close).toBe(100.9);
  });

  it('folds each tick once under StrictMode', () => {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const h = setup(opts({ tick: tick(100.5, 301, 5) }), wrapper);
    flushFrame();
    expect(lastOf(h.result.current.bars).volume).toBe(5);
  });

  it('does not fold the previous symbol\'s last tick into a new key', () => {
    const t = tick(250, 10);
    const h = setup(opts({ tick: t }));
    flushFrame();
    h.rerender(opts({ key: 'ABC', tick: t }));
    flushFrame();
    expect(h.result.current.live).toBeNull();
    expect(h.result.current.bars).toBe(REST);
    h.rerender(opts({ key: 'ABC', tick: tick(101, 11) }));
    flushFrame();
    expect(h.result.current.live?.price).toBe(101);
  });

  it('refolds the current tick after a timeframe change on the same key', () => {
    const t = tick(100.7, 10);
    const h = setup(opts({ tick: t }));
    flushFrame();
    h.rerender(opts({ timeframe: '1Min', tick: t }));
    flushFrame();
    expect(h.result.current.live).toMatchObject({ price: 100.7, barCloseAt: T0 + 60_000 });
  });

  it('clears its output when the key goes to null', () => {
    const h = setup(opts({ tick: tick(100.9, 10) }));
    flushFrame();
    h.rerender(opts({ key: null, tick: tick(100.9, 10) }));
    expect(h.result.current.bars).toBe(REST);
    expect(h.result.current.live).toBeNull();
  });

  it('backfills when a tick lands two or more buckets past the newest bar', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0, toMs: T0 + 900_000 }, withSignal);
    calls[0].resolve([
      { timestamp: T0 + 300_000, open: 100.2, high: 100.5, low: 100.1, close: 100.4, volume: 3 },
      { timestamp: T0 + 600_000, open: 100.4, high: 100.7, low: 100.3, close: 100.6, volume: 4 },
    ]);
    await settle();
    flushFrame();
    expect(h.result.current.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, T0 + 300_000, T0 + 600_000, T0 + 900_000]);
  });

  it('backfills after a reconnect, not on the first open', async () => {
    const fetchGap = vi.fn(() => Promise.resolve<OHLCVBar[]>([]));
    const h = setup(opts({ fetchGap }));
    expect(fetchGap).not.toHaveBeenCalled();
    h.rerender(opts({ fetchGap, connection: 'closed' }));
    vi.setSystemTime(T0 + 700_000);
    h.rerender(opts({ fetchGap, connection: 'connecting' }));
    h.rerender(opts({ fetchGap, connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0, toMs: T0 + 600_000 }, withSignal);
    await settle();
  });

  it('backfills after open, connecting, open', async () => {
    const fetchGap = vi.fn(() => Promise.resolve<OHLCVBar[]>([]));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, connection: 'connecting' }));
    vi.setSystemTime(T0 + 700_000);
    h.rerender(opts({ fetchGap, connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0, toMs: T0 + 600_000 }, withSignal);
    await settle();
  });

  it('backfills from where the stream dropped when the reopen render also brings a tick', async () => {
    const fetchGap = vi.fn(() => Promise.resolve<OHLCVBar[]>([]));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, connection: 'closed' }));
    vi.setSystemTime(T0 + 400_000);
    h.rerender(opts({ fetchGap, connection: 'open', tick: tick(100.5, 399) }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0, toMs: T0 + 300_000 }, withSignal);
    await settle();
  });

  it('never asks for a range that ends before it starts when ticks run ahead of the clock', async () => {
    const fetchGap = vi.fn(() => Promise.resolve<OHLCVBar[]>([]));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.5, 301) }));
    h.rerender(opts({ fetchGap, tick: tick(100.5, 301), connection: 'closed' }));
    h.rerender(opts({ fetchGap, tick: tick(100.5, 301), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0 + 300_000, toMs: T0 + 300_000 }, withSignal);
    await settle();
  });

  it('runs one fetch at a time and fetches again if a gap remains', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    flushFrame();
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'closed' }));
    vi.setSystemTime(T0 + 1_500_000);
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    calls[0].resolve([]);
    await settle();
    expect(fetchGap).toHaveBeenCalledTimes(2);
    expect(fetchGap).toHaveBeenLastCalledWith({ fromMs: T0 + 900_000, toMs: T0 + 1_500_000 }, withSignal);
  });

  it('issues a reconnect that lands during a fetch even when it spans one bucket', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'closed' }));
    vi.setSystemTime(T0 + 1_250_000);
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    calls[0].resolve([]);
    await settle();
    expect(fetchGap).toHaveBeenCalledTimes(2);
    expect(fetchGap).toHaveBeenLastCalledWith({ fromMs: T0 + 900_000, toMs: T0 + 1_200_000 }, withSignal);
  });

  it('applies gap responses in request order', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'closed' }));
    vi.setSystemTime(T0 + 1_250_000);
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'open' }));
    calls[0].resolve([bar(300, 1)]);
    await settle();
    calls[1].resolve([bar(300, 2)]);
    await settle();
    flushFrame();
    expect(h.result.current.bars.find((b) => b.timestamp === T0 + 300_000)?.close).toBe(2);
  });

  it('lets the host\'s bars win over a gap response that lands after a REST refetch', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    const refetched = [...REST, bar(300, 50), bar(600, 60)];
    h.rerender(opts({ fetchGap, bars: refetched, tick: tick(100.6, 901) }));
    calls[0].resolve([bar(300, 1), bar(600, 2)]);
    await settle();
    flushFrame();
    const out = h.result.current.bars;
    expect(out.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, T0 + 300_000, T0 + 600_000, T0 + 900_000]);
    expect(out[2]).toBe(refetched[2]);
    expect(out[3].close).toBe(60);
  });

  it('forgets gap bars once the host has its own bars for them', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    calls[0].resolve([bar(300, 1), bar(600, 2)]);
    await settle();
    flushFrame();
    h.rerender(opts({ fetchGap, bars: [...REST, bar(300, 50), bar(600, 60)], tick: tick(100.6, 901) }));
    h.rerender(opts({ fetchGap, bars: REST, tick: tick(100.6, 902) }));
    flushFrame();
    expect(h.result.current.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, T0 + 900_000]);
  });

  it('drops a gap response that arrives after a key change, and aborts its request', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    h.rerender(opts({ fetchGap, key: 'ABC', tick: null }));
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].resolve([{ timestamp: T0 + 300_000, open: 1, high: 1, low: 1, close: 1, volume: 1 }]);
    await settle();
    flushFrame();
    expect(h.result.current.bars).toBe(REST);
  });

  it('drops a gap response that arrives after a timeframe change', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    const t = tick(100.6, 901);
    h.rerender(opts({ fetchGap, tick: t }));
    h.rerender(opts({ fetchGap, timeframe: '1Min', tick: t }));
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].resolve([bar(300, 1)]);
    await settle();
    flushFrame();
    expect(h.result.current.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, T0 + 900_000]);
  });

  it('ignores a gap response that arrives after unmount, and aborts its request', async () => {
    const { fetchGap, calls } = controlledFetch();
    const onGapError = vi.fn();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const h = setup(opts({ fetchGap, onGapError }));
    h.rerender(opts({ fetchGap, onGapError, tick: tick(100.6, 901) }));
    h.unmount();
    await settle();
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].resolve([{ timestamp: T0 + 300_000, open: 1, high: 1, low: 1, close: 1, volume: 1 }]);
    await settle();
    expect(onGapError).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('reports a failed gap fetch and does not retry on its own', async () => {
    const fetchGap = vi.fn(() => Promise.reject(new Error('boom')));
    const onGapError = vi.fn();
    const h = setup(opts({ fetchGap, onGapError }));
    h.rerender(opts({ fetchGap, onGapError, tick: tick(100.6, 901) }));
    await settle();
    expect(onGapError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    advance(120_000);
    expect(fetchGap).toHaveBeenCalledTimes(1);
  });

  it('fetches again on the next trigger after a failure', async () => {
    const fetchGap = vi.fn(() => Promise.reject(new Error('boom')));
    const h = setup(opts({ fetchGap, onGapError: () => undefined }));
    h.rerender(opts({ fetchGap, onGapError: () => undefined, tick: tick(100.6, 901) }));
    await settle();
    h.rerender(opts({ fetchGap, onGapError: () => undefined, tick: tick(100.6, 1501) }));
    await settle();
    expect(fetchGap).toHaveBeenCalledTimes(2);
    expect(fetchGap).toHaveBeenLastCalledWith({ fromMs: T0 + 900_000, toMs: T0 + 1_500_000 }, withSignal);
  });

  it('reports a gap response that is not an array', async () => {
    const fetchGap = vi.fn(() => Promise.resolve(null as unknown as OHLCVBar[]));
    const onGapError = vi.fn();
    const h = setup(opts({ fetchGap, onGapError }));
    h.rerender(opts({ fetchGap, onGapError, tick: tick(100.6, 901) }));
    await settle();
    expect(onGapError).toHaveBeenCalledWith(expect.any(TypeError));
  });

  it('treats a fetched bar as final for a bucket that had closed when it was requested', async () => {
    const fetched: OHLCVBar = { timestamp: T0 + 300_000, open: 100.2, high: 100.9, low: 100.1, close: 100.5, volume: 7 };
    const fetchGap = vi.fn(() => Promise.resolve([fetched]));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(101.5, 301) }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 601) }));
    flushFrame();
    h.rerender(opts({ fetchGap, tick: tick(100.6, 601), connection: 'closed' }));
    vi.setSystemTime(T0 + 601_000);
    h.rerender(opts({ fetchGap, tick: tick(100.6, 601), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0 + 600_000, toMs: T0 + 600_000 }, withSignal);
    await settle();
    flushFrame();
    expect(h.result.current.bars.find((b) => b.timestamp === T0 + 300_000)).toEqual(fetched);
  });

  it('keeps the live extremes of a closed bucket fetched while it was still forming', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.5, 301) }));
    h.rerender(opts({ fetchGap, tick: tick(100.5, 301), connection: 'closed' }));
    vi.setSystemTime(T0 + 400_000);
    h.rerender(opts({ fetchGap, tick: tick(100.5, 301), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0 + 300_000, toMs: T0 + 300_000 }, withSignal);
    h.rerender(opts({ fetchGap, tick: tick(105, 500) }));
    h.rerender(opts({ fetchGap, tick: tick(101, 601) }));
    calls[0].resolve([{ timestamp: T0 + 300_000, open: 100.2, high: 100.6, low: 100.1, close: 100.5, volume: 3 }]);
    await settle();
    flushFrame();
    expect(h.result.current.bars.find((b) => b.timestamp === T0 + 300_000)).toEqual({
      timestamp: T0 + 300_000,
      open: 100.2,
      high: 105,
      low: 100.1,
      close: 105,
      volume: 3,
    });
  });

  it('merges a fetched bar for the forming bucket: the wider range wins and the close stays live', async () => {
    const { fetchGap, calls } = controlledFetch();
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 301) }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 301), connection: 'closed' }));
    vi.setSystemTime(T0 + 400_000);
    h.rerender(opts({ fetchGap, tick: tick(100.6, 301), connection: 'open' }));
    calls[0].resolve([{ timestamp: T0 + 300_000, open: 100.2, high: 101, low: 100, close: 100.9, volume: 9 }]);
    await settle();
    flushFrame();
    expect(lastOf(h.result.current.bars)).toEqual({ timestamp: T0 + 300_000, open: 100.2, high: 101, low: 100, close: 100.6, volume: 9 });
    h.rerender(opts({ fetchGap, tick: tick(101.2, 302) }));
    flushFrame();
    expect(lastOf(h.result.current.bars)).toEqual({ timestamp: T0 + 300_000, open: 100.2, high: 101.2, low: 100, close: 101.2, volume: 9 });
  });

  it('ignores a non-positive price, so it moves neither the price nor the last tick time', () => {
    const h = setup(opts({ tick: tick(100.9, 20) }));
    flushFrame();
    h.rerender(opts({ tick: tick(0, 25) }));
    h.rerender(opts({ tick: tick(-1, 26) }));
    flushFrame();
    expect(h.result.current.live?.price).toBe(100.9);
    h.rerender(opts({ tick: tick(100.5, 22) }));
    flushFrame();
    expect(h.result.current.live?.price).toBe(100.5);
    expect(lastOf(h.result.current.bars).close).toBe(100.5);
  });
});
