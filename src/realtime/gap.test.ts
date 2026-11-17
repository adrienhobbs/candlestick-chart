import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../types/chart';
import { currentBucket, mergeGapBars, normalizeBars, tickGap, withGapBars } from './gap';

const T0 = Date.parse('2026-10-30T16:25:00Z');
const bar = (t: number, close = 100): OHLCVBar => ({ timestamp: t, open: 100, high: 101, low: 99, close, volume: 1 });

describe('tickGap', () => {
  it('is null one bucket ahead and a range two or more buckets ahead', () => {
    expect(tickGap(T0, '5Min', T0 + 300_000 + 1_000)).toBeNull();
    expect(tickGap(T0, '5Min', T0 + 600_000 + 1_000)).toEqual({ fromMs: T0, toMs: T0 + 600_000 });
  });
  it('is null without bars or on 1Day', () => {
    expect(tickGap(null, '5Min', T0)).toBeNull();
    expect(tickGap(T0, '1Day', T0 + 10 * 86_400_000)).toBeNull();
  });
  it('treats unknown and prototype-key timeframes as unsupported', () => {
    expect(tickGap(T0, 'constructor', T0 + 10 * 86_400_000)).toBeNull();
    expect(tickGap(T0, 'toString', T0 + 10 * 86_400_000)).toBeNull();
    expect(tickGap(T0, '3Min', T0 + 10 * 86_400_000)).toBeNull();
  });
});

describe('currentBucket', () => {
  it('floors intraday and passes the time through otherwise', () => {
    expect(currentBucket('5Min', T0 + 299_000)).toBe(T0);
    expect(currentBucket('1Day', T0 + 5)).toBe(T0 + 5);
  });
  it('passes the time through for prototype-key timeframes', () => {
    expect(currentBucket('constructor', T0 + 5)).toBe(T0 + 5);
    expect(currentBucket('__proto__', T0 + 5)).toBe(T0 + 5);
  });
});

describe('normalizeBars / mergeGapBars', () => {
  it('sorts and dedupes, the later entry winning', () => {
    expect(normalizeBars([bar(T0 + 300_000), bar(T0, 1), bar(T0, 2)]).map((b) => [b.timestamp, b.close])).toEqual([
      [T0, 2],
      [T0 + 300_000, 100],
    ]);
    expect(mergeGapBars([bar(T0, 1)], [bar(T0, 3)])[0].close).toBe(3);
  });
});

describe('withGapBars', () => {
  it('appends only gap bars newer than the host bars', () => {
    const host = [bar(T0)];
    expect(withGapBars(host, [])).toBe(host);
    expect(withGapBars(host, [bar(T0, 5)])).toBe(host);
    expect(withGapBars(host, [bar(T0), bar(T0 + 300_000)]).map((b) => b.timestamp)).toEqual([T0, T0 + 300_000]);
    expect(withGapBars([], [bar(T0)])).toHaveLength(1);
  });
});

describe('tickGap edges', () => {
  it('floors an unaligned newest stamp before comparing, keeping fromMs as given', () => {
    expect(tickGap(T0 + 120_000, '5Min', T0 + 600_000)).toEqual({ fromMs: T0 + 120_000, toMs: T0 + 600_000 });
  });
  it('is a range exactly on the two-bucket boundary', () => {
    expect(tickGap(T0, '5Min', T0 + 600_000)).toEqual({ fromMs: T0, toMs: T0 + 600_000 });
    expect(tickGap(T0, '5Min', T0 + 599_999)).toBeNull();
  });
  it('is null for a tick older than the newest bar', () => {
    expect(tickGap(T0, '5Min', T0 - 600_000)).toBeNull();
  });
  it('works at 1Min', () => {
    expect(tickGap(T0, '1Min', T0 + 120_000)).toEqual({ fromMs: T0, toMs: T0 + 120_000 });
    expect(tickGap(T0, '1Min', T0 + 119_999)).toBeNull();
    expect(currentBucket('1Min', T0 + 59_999)).toBe(T0);
  });
  it('works at 1Hour, including bars stamped at :30', () => {
    const H = Date.parse('2026-10-30T13:00:00Z');
    const H30 = Date.parse('2026-10-30T13:30:00Z');
    expect(currentBucket('1Hour', H + 59 * 60_000)).toBe(H);
    expect(tickGap(H30, '1Hour', H + 2 * 3_600_000)).toEqual({ fromMs: H30, toMs: H + 2 * 3_600_000 });
    expect(tickGap(H30, '1Hour', H + 2 * 3_600_000 - 1)).toBeNull();
  });
});

describe('normalizeBars edges', () => {
  it('drops bars with a NaN timestamp and handles an empty list', () => {
    expect(normalizeBars([bar(NaN), bar(T0)]).map((b) => b.timestamp)).toEqual([T0]);
    expect(normalizeBars([])).toEqual([]);
  });
});
