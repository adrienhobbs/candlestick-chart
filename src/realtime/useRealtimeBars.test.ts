// src/realtime/useRealtimeBars.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode, createElement, type ReactNode } from 'react';
import type { OHLCVBar } from '../types/chart';
import { useRealtimeBars, type UseRealtimeBarsOptions } from './useRealtimeBars';
import type { RealtimeTick } from './types';

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
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
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
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(h.result.current.live?.state).toBe('stalled');
    h.rerender(opts({ connection: 'closed', tick: t }));
    expect(h.result.current.live?.state).toBe('disconnected');
    h.rerender(opts({ connection: 'open', tick: t }));
    expect(h.result.current.live?.state).toBe('connecting');
    h.rerender(opts({ connection: 'open', tick: tick(100.4, 40) }));
    flushFrame();
    expect(h.result.current.live?.state).toBe('live');
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

  it('backfills when a tick lands two or more buckets past the newest bar', async () => {
    let resolve: (bars: OHLCVBar[]) => void = () => undefined;
    const fetchGap = vi.fn(() => new Promise<OHLCVBar[]>((r) => (resolve = r)));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0, toMs: T0 + 900_000 });
    resolve([
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
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0, toMs: T0 + 600_000 });
    await settle();
  });

  it('runs one fetch at a time and fetches again if a gap remains', async () => {
    let resolve: (bars: OHLCVBar[]) => void = () => undefined;
    const fetchGap = vi.fn(() => new Promise<OHLCVBar[]>((r) => (resolve = r)));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    flushFrame();
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'closed' }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledTimes(1);
    vi.setSystemTime(T0 + 1_500_000);
    resolve([]);
    await settle();
    expect(fetchGap).toHaveBeenCalledTimes(2);
    expect(fetchGap).toHaveBeenLastCalledWith({ fromMs: T0 + 900_000, toMs: T0 + 1_500_000 });
  });

  it('drops a gap response that arrives after a key change', async () => {
    let resolve: (bars: OHLCVBar[]) => void = () => undefined;
    const fetchGap = vi.fn(() => new Promise<OHLCVBar[]>((r) => (resolve = r)));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 901) }));
    h.rerender(opts({ fetchGap, key: 'ABC', tick: null }));
    resolve([{ timestamp: T0 + 300_000, open: 1, high: 1, low: 1, close: 1, volume: 1 }]);
    await settle();
    flushFrame();
    expect(h.result.current.bars).toBe(REST);
  });

  it('ignores a gap response that arrives after unmount', async () => {
    let resolve: (bars: OHLCVBar[]) => void = () => undefined;
    const fetchGap = vi.fn(() => new Promise<OHLCVBar[]>((r) => (resolve = r)));
    const onGapError = vi.fn();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const h = setup(opts({ fetchGap, onGapError }));
    h.rerender(opts({ fetchGap, onGapError, tick: tick(100.6, 901) }));
    h.unmount();
    resolve([{ timestamp: T0 + 300_000, open: 1, high: 1, low: 1, close: 1, volume: 1 }]);
    await settle();
    expect(onGapError).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('reports a failed gap fetch and does not retry on its own', async () => {
    const fetchGap = vi.fn(() => Promise.reject(new Error('boom')));
    const onGapError = vi.fn();
    const h = setup(opts({ fetchGap, onGapError }));
    h.rerender(opts({ fetchGap, onGapError, tick: tick(100.6, 901) }));
    await settle();
    expect(onGapError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(fetchGap).toHaveBeenCalledTimes(1);
  });

  it('treats a fetched bar as final for a closed bucket', async () => {
    const fetched: OHLCVBar = { timestamp: T0 + 300_000, open: 100.2, high: 100.9, low: 100.1, close: 100.5, volume: 7 };
    const fetchGap = vi.fn(() => Promise.resolve([fetched]));
    const h = setup(opts({ fetchGap }));
    h.rerender(opts({ fetchGap, tick: tick(101.5, 301) }));
    h.rerender(opts({ fetchGap, tick: tick(100.6, 601) }));
    flushFrame();
    h.rerender(opts({ fetchGap, tick: tick(100.6, 601), connection: 'closed' }));
    vi.setSystemTime(T0 + 601_000);
    h.rerender(opts({ fetchGap, tick: tick(100.6, 601), connection: 'open' }));
    expect(fetchGap).toHaveBeenCalledWith({ fromMs: T0 + 600_000, toMs: T0 + 600_000 });
    await settle();
    flushFrame();
    expect(h.result.current.bars.find((b) => b.timestamp === T0 + 300_000)).toEqual(fetched);
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
