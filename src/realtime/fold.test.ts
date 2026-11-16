import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../types/chart';
import { foldTick, mergeLive, MAX_CLOSED } from './fold';
import type { LiveFoldState } from './types';

const T0 = Date.parse('2026-10-30T16:25:00Z'); // 12:25 ET, a 5Min bucket start
const at = (s: number) => T0 + s * 1000;
const REST: OHLCVBar[] = [
  { timestamp: T0 - 300_000, open: 99, high: 100.1, low: 98.9, close: 100, volume: 5 },
  { timestamp: T0, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 },
];

interface Step {
  price: number;
  s: number;
  bars?: OHLCVBar[];
  key?: string;
  timeframe?: string;
  size?: number;
  time?: number | string;
}

/** Feeds ticks through foldTick the way the hook does, returning each pass. */
function fold(steps: Step[]) {
  let state: LiveFoldState | null = null;
  return steps.map((t) => {
    const out = foldTick(state, {
      key: t.key ?? 'XYZ',
      bars: t.bars ?? REST,
      timeframe: t.timeframe ?? '5Min',
      tick: { price: t.price, time: t.time ?? at(t.s), size: t.size },
    });
    state = out.state;
    return out;
  });
}
const lastBar = (o: { bars: OHLCVBar[] }) => o.bars[o.bars.length - 1];
const hlc = (b: OHLCVBar) => ({ high: b.high, low: b.low, close: b.close });

describe('foldTick', () => {
  it("keeps a spike's wick on the next tick", () => {
    const [spike, after] = fold([{ price: 100.9, s: 10 }, { price: 100.3, s: 11 }]);
    expect(lastBar(spike).high).toBe(100.9);
    expect(hlc(lastBar(after))).toEqual({ high: 100.9, low: 99.8, close: 100.3 });
  });

  it("keeps a dip's low too", () => {
    const [, after] = fold([{ price: 99.5, s: 10 }, { price: 100.1, s: 11 }]);
    expect(hlc(lastBar(after))).toEqual({ high: 100.4, low: 99.5, close: 100.1 });
  });

  it('keeps whichever extreme is wider after a refetch, live or REST', () => {
    const lagging: OHLCVBar[] = [REST[0], { ...REST[1], high: 100.5, low: 99.9 }];
    const wider: OHLCVBar[] = [REST[0], { ...REST[1], high: 101.2, low: 99.1 }];
    const [, afterLagging, afterWider] = fold([
      { price: 100.9, s: 10 },
      { price: 100.6, s: 70, bars: lagging },
      { price: 100.6, s: 71, bars: wider },
    ]);
    expect(lastBar(afterLagging).high).toBe(100.9);
    expect(lastBar(afterLagging).low).toBe(99.9);
    expect({ high: lastBar(afterWider).high, low: lastBar(afterWider).low }).toEqual({ high: 101.2, low: 99.1 });
  });

  it('opens a new bucket at the previous close without leaking the old spike', () => {
    const [, , appended, next] = fold([
      { price: 100.9, s: 10 },
      { price: 100.3, s: 290 },
      { price: 100.5, s: 301 },
      { price: 100.7, s: 302 },
    ]);
    const a = lastBar(appended);
    expect(a.timestamp).toBe(T0 + 300_000);
    expect({ open: a.open, high: a.high, low: a.low }).toEqual({ open: 100.3, high: 100.5, low: 100.3 });
    expect(hlc(lastBar(next))).toEqual({ high: 100.7, low: 100.3, close: 100.7 });
  });

  it('a tick exactly on a bucket boundary belongs to the new bucket', () => {
    const [out] = fold([{ price: 100.5, s: 300 }]);
    expect(lastBar(out).timestamp).toBe(T0 + 300_000);
  });

  it("keeps a spike's wick across the rollover", () => {
    const outs = fold([
      { price: 100.9, s: 10 },
      { price: 100.6, s: 290 },
      { price: 100.5, s: 301 },
      { price: 100.4, s: 330 },
    ]);
    for (const out of [outs[2], outs[3]]) {
      const closed = out.bars.find((b) => b.timestamp === T0)!;
      expect(hlc(closed)).toEqual({ high: 100.9, low: 99.8, close: 100.6 });
    }
    expect(lastBar(outs[3]).timestamp).toBe(T0 + 300_000);
  });

  it('keeps a closed bar REST has not fetched yet', () => {
    const [, , twoAhead] = fold([
      { price: 100.5, s: 301 },
      { price: 101.1, s: 400 },
      { price: 100.8, s: 601 },
    ]);
    expect(twoAhead.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, T0 + 300_000, T0 + 600_000]);
    const c = twoAhead.bars[2];
    expect({ open: c.open, high: c.high, low: c.low, close: c.close }).toEqual({ open: 100.2, high: 101.1, low: 100.2, close: 101.1 });
  });

  it('keeps every live-only closed bar while REST lags, then drops each as REST covers it', () => {
    const partial: OHLCVBar[] = [...REST, { timestamp: T0 + 300_000, open: 100.2, high: 100.5, low: 100.2, close: 100.5, volume: 2 }];
    const [, , stuck, caughtUpOne] = fold([
      { price: 100.5, s: 301 },
      { price: 100.8, s: 601 },
      { price: 100.6, s: 901 },
      { price: 100.6, s: 902, bars: partial },
    ]);
    const times = (bars: OHLCVBar[]) => bars.map((b) => b.timestamp);
    expect(times(stuck.bars)).toEqual([T0 - 300_000, T0, T0 + 300_000, T0 + 600_000, T0 + 900_000]);
    expect(times(caughtUpOne.bars)).toEqual(times(stuck.bars));
    expect(caughtUpOne.bars[2]).toEqual(partial[2]);
    expect(caughtUpOne.bars[3].close).toBe(100.8);
  });

  it("uses REST's bar as-is once REST has a newer bar", () => {
    const final: OHLCVBar[] = [
      REST[0],
      { ...REST[1], high: 100.95, close: 100.55 },
      { timestamp: T0 + 300_000, open: 100.5, high: 100.6, low: 100.4, close: 100.5, volume: 3 },
    ];
    const [, , refetched] = fold([
      { price: 100.9, s: 10 },
      { price: 100.5, s: 301 },
      { price: 100.5, s: 360, bars: final },
    ]);
    expect(refetched.bars[1]).toEqual(final[1]);
  });

  it('keeps an appended bar’s extremes until REST catches up', () => {
    const caughtUp: OHLCVBar[] = [...REST, { timestamp: T0 + 300_000, open: 100.2, high: 100.6, low: 100.3, close: 100.4, volume: 2 }];
    const [, dipped, refetched] = fold([
      { price: 100.0, s: 301 },
      { price: 100.4, s: 302 },
      { price: 100.4, s: 360, bars: caughtUp },
    ]);
    expect(lastBar(dipped).low).toBe(100.0);
    expect({ high: lastBar(refetched).high, low: lastBar(refetched).low }).toEqual({ high: 100.6, low: 100.0 });
  });

  it('resets on a key or timeframe change', () => {
    const [, otherKey] = fold([{ price: 100.9, s: 10 }, { price: 100.3, s: 11, key: 'ABC' }]);
    expect(lastBar(otherKey).high).toBe(100.4);
    const [, otherTf] = fold([{ price: 100.9, s: 10 }, { price: 100.3, s: 11, timeframe: '15Min' }]);
    expect(lastBar(otherTf).high).toBe(100.4);
  });

  it('ignores unusable ticks but keeps the live shape', () => {
    const [first] = fold([{ price: 100.9, s: 10 }]);
    for (const tick of [{ price: Number.NaN, time: at(11) }, { price: 100.3, time: 'not a date' }]) {
      const out = foldTick(first.state, { key: 'XYZ', bars: REST, timeframe: '5Min', tick });
      expect(out.state).toBe(first.state);
      expect(lastBar(out).high).toBe(100.9);
    }
  });

  it('ignores a tick older than the last folded tick', () => {
    const [newer, older] = fold([{ price: 100.9, s: 20 }, { price: 100.1, s: 10 }]);
    expect(older.state).toBe(newer.state);
    expect(lastBar(older).close).toBe(100.9);
  });

  it("ignores a tick older than the last bar's bucket", () => {
    const [out] = fold([{ price: 101, s: -10 }]);
    expect(out.bars).toBe(REST);
    expect(out.state).toBeNull();
  });

  it('returns the same array when a tick changes nothing', () => {
    const [out] = fold([{ price: 100.2, s: 10 }]);
    expect(out.bars).toBe(REST);
  });

  it(`caps the closed list at ${MAX_CLOSED}`, () => {
    const outs = fold(Array.from({ length: 35 }, (_, i) => ({ price: 100 + i / 100, s: 300 * (i + 1) + 1 })));
    const last = outs[outs.length - 1];
    expect(last.state!.closed).toHaveLength(MAX_CLOSED);
    expect(last.bars).toHaveLength(REST.length + MAX_CLOSED + 1);
  });

  it('adds tick size to volume, never below the REST volume', () => {
    const [, appended] = fold([{ price: 100.5, s: 301, size: 10 }, { price: 100.6, s: 302, size: 5 }]);
    expect(lastBar(appended).volume).toBe(15);
    const [covered] = fold([{ price: 100.3, s: 10, size: 3 }]);
    expect(lastBar(covered).volume).toBe(3);
  });

  it('daily bars take regular-session ticks only and never append', () => {
    const day = Date.parse('2026-10-30T04:00:00Z'); // midnight ET
    const bars: OHLCVBar[] = [{ timestamp: day, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 }];
    const spike = foldTick(null, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 101, time: '2026-10-30T16:00:00Z' } });
    const after = foldTick(spike.state, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 100.5, time: '2026-10-30T16:00:05Z' } });
    expect(lastBar(after).high).toBe(101);
    const afterHours = foldTick(null, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 103, time: '2026-10-30T21:30:00Z' } });
    expect(afterHours.bars).toBe(bars);
    const nextDay = foldTick(null, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 103, time: '2026-11-02T15:00:00Z' } });
    expect(nextDay.bars).toBe(bars);
  });
});

describe('mergeLive', () => {
  it('re-applies the live state to fresh bars, and is a no-op without state', () => {
    const [spike] = fold([{ price: 100.9, s: 10 }]);
    expect(lastBar({ bars: mergeLive([...REST], spike.state) }).high).toBe(100.9);
    expect(mergeLive(REST, null)).toBe(REST);
  });
});
