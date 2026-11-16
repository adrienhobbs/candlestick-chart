import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../types/chart';
import { foldTick, intradayBucketMs, mergeLive, MAX_CLOSED } from './fold';
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
    // The live bucket remembers REST's earlier low of 99.8, and the merge keeps the wider of that and the refetch's 99.9.
    expect(lastBar(afterLagging).low).toBe(99.8);
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
    expect(last.bars).toHaveLength(REST.length + MAX_CLOSED + 1);
  });

  it('adds tick size to volume, never below the REST volume', () => {
    const [, appended] = fold([{ price: 100.5, s: 301, size: 10 }, { price: 100.6, s: 302, size: 5 }]);
    expect(lastBar(appended).volume).toBe(15);
    // A covered bucket starts from REST's volume (1) and adds the tick's size.
    const [covered] = fold([{ price: 100.3, s: 10, size: 3 }]);
    expect(lastBar(covered).volume).toBe(4);
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

describe('foldTick seeding and timeframes', () => {
  it("a live bucket starts from REST's bar, so a shorter refetch keeps its open and extremes", () => {
    const B: OHLCVBar = { timestamp: T0, open: 100.0, high: 100.4, low: 99.8, close: 100.2, volume: 100 };
    const [, shorter] = fold([
      { price: 100.2, s: 10, bars: [REST[0], B] },
      { price: 100.25, s: 11, bars: [REST[0]] },
    ]);
    const b = lastBar(shorter);
    expect(b.timestamp).toBe(T0);
    expect({ open: b.open, high: b.high, low: b.low, close: b.close }).toEqual({ open: 100.0, high: 100.4, low: 99.8, close: 100.25 });
  });

  it('buckets 1Min ticks by the minute', () => {
    const [out] = fold([{ price: 100.5, s: 90, timeframe: '1Min' }]);
    expect(lastBar(out).timestamp).toBe(T0 + 60_000);
    expect(out.bars).toHaveLength(REST.length + 1);
  });

  it('buckets 1Hour ticks by the hour', () => {
    const hour = Date.parse('2026-10-30T17:00:00Z');
    const bars: OHLCVBar[] = [{ timestamp: hour, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 }];
    const out = foldTick(null, { key: 'XYZ', bars, timeframe: '1Hour', tick: { price: 101, time: '2026-10-30T17:25:00Z' } });
    expect(out.bars).toHaveLength(1);
    expect(lastBar(out)).toMatchObject({ timestamp: hour, high: 101, close: 101 });
  });

  it('daily bars ignore a pre-market tick', () => {
    const day = Date.parse('2026-10-30T04:00:00Z');
    const bars: OHLCVBar[] = [{ timestamp: day, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 }];
    const out = foldTick(null, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 103, time: '2026-10-30T13:00:00Z' } }); // 09:00 ET
    expect(out.bars).toBe(bars);
    expect(out.state).toBeNull();
  });

  it('with no REST bars, returns the empty bars and the previous state', () => {
    const [first] = fold([{ price: 100.9, s: 10 }]);
    const empty: OHLCVBar[] = [];
    const out = foldTick(first.state, { key: 'XYZ', bars: empty, timeframe: '5Min', tick: { price: 101, time: at(11) } });
    expect(out.bars).toBe(empty);
    expect(out.state).toBe(first.state);
  });
});

describe('foldTick review fixes', () => {
  it('does not draw a wick to the seeded open once REST returns the appended bucket', () => {
    const returned: OHLCVBar[] = [...REST, { timestamp: T0 + 300_000, open: 100.5, high: 100.6, low: 100.45, close: 100.5, volume: 2 }];
    const [appended, merged] = fold([
      { price: 100.5, s: 301 },
      { price: 100.5, s: 302, bars: returned },
    ]);
    expect({ open: lastBar(appended).open, low: lastBar(appended).low }).toEqual({ open: 100.2, low: 100.2 });
    const m = lastBar(merged);
    expect({ open: m.open, high: m.high, low: m.low, close: m.close }).toEqual({ open: 100.5, high: 100.6, low: 100.45, close: 100.5 });
  });

  it('a shorter refetch keeps REST volume', () => {
    const B: OHLCVBar = { timestamp: T0, open: 100.0, high: 100.4, low: 99.8, close: 100.2, volume: 100 };
    const [, shorter] = fold([
      { price: 100.2, s: 10, size: 5, bars: [REST[0], B] },
      { price: 100.25, s: 11, size: 2, bars: [REST[0]] },
    ]);
    expect(lastBar(shorter).volume).toBe(107);
  });

  it('a covered bucket that closed keeps REST’s open, extremes and volume when a refetch drops it', () => {
    const B: OHLCVBar = { timestamp: T0, open: 100.0, high: 100.4, low: 99.8, close: 100.2, volume: 100 };
    const [, , shorter] = fold([
      { price: 100.3, s: 10, size: 5, bars: [REST[0], B] },
      { price: 100.5, s: 301, bars: [REST[0], B] },
      { price: 100.6, s: 302, bars: [REST[0]] },
    ]);
    expect(shorter.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, T0 + 300_000]);
    expect(shorter.bars[1]).toEqual({ timestamp: T0, open: 100.0, high: 100.4, low: 99.8, close: 100.3, volume: 105 });
    expect(lastBar(shorter).open).toBe(100.3);
  });

  it('ignores a non-positive price and treats a non-finite size as zero', () => {
    for (const price of [0, -1]) {
      const [out] = fold([{ price, s: 10 }]);
      expect(out.bars).toBe(REST);
      expect(out.state).toBeNull();
    }
    const [, appended] = fold([{ price: 100.5, s: 301, size: Number.POSITIVE_INFINITY }, { price: 100.6, s: 302, size: 2 }]);
    expect(lastBar(appended).volume).toBe(2);
  });

  it('does not treat a prototype key as an intraday timeframe', () => {
    const [out] = fold([{ price: 100.5, s: 10, timeframe: 'constructor' }]);
    expect(out.bars).toBe(REST);
    expect(out.state).toBeNull();
  });

  it('daily bars use the New York session after the DST change', () => {
    const day = Date.parse('2026-11-02T05:00:00Z'); // midnight ET, after DST ends
    const bars: OHLCVBar[] = [{ timestamp: day, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 }];
    const open = foldTick(null, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 101, time: '2026-11-02T14:31:00Z' } }); // 09:31 ET
    expect(lastBar(open).high).toBe(101);
    const pre = foldTick(null, { key: 'XYZ', bars, timeframe: '1Day', tick: { price: 101, time: '2026-11-02T13:45:00Z' } }); // 08:45 ET
    expect(pre.bars).toBe(bars);
  });
});

describe('foldTick backwards refetch and volume', () => {
  const B1 = T0 + 300_000;
  const B2 = T0 + 600_000;
  const B3 = T0 + 900_000;
  const partial = (timestamp: number, high: number, low: number): OHLCVBar => ({ timestamp, open: low, high, low, close: high, volume: 1 });
  const throughThree: OHLCVBar[] = [...REST, partial(B1, 100.6, 100.4), partial(B2, 100.0, 99.9), partial(B3, 100.6, 100.6)];
  const live: Step[] = [
    { price: 100.5, s: 301 },
    { price: 101.0, s: 400 },
    { price: 99.5, s: 601 },
    { price: 100.8, s: 700 },
    { price: 100.6, s: 901 },
    { price: 100.6, s: 902, bars: throughThree },
  ];

  it('keeps closed buckets when a later refetch ends before them', () => {
    const outs = fold([...live, { price: 100.6, s: 903, bars: [...REST, partial(B1, 100.6, 100.4)] }]);
    const out = outs[outs.length - 1];
    expect(out.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, B1, B2, B3]);
    expect(out.bars[3]).toMatchObject({ low: 99.5, close: 100.8 });
  });

  it('a refetch ending at a partial closed bucket keeps its traded extremes', () => {
    const outs = fold([...live, { price: 100.6, s: 903, bars: [...REST, partial(B1, 100.6, 100.4), partial(B2, 100.0, 99.9)] }]);
    const out = outs[outs.length - 1];
    expect(out.bars.map((b) => b.timestamp)).toEqual([T0 - 300_000, T0, B1, B2, B3]);
    expect(out.bars[3]).toMatchObject({ high: 100.8, low: 99.5, close: 100.8 });
  });

  it('a covered bucket’s volume never trails a refetch that grew REST’s volume', () => {
    const grown: OHLCVBar[] = [REST[0], { ...REST[1], volume: 50 }];
    const [first, second] = fold([{ price: 100.3, s: 10, size: 3 }, { price: 100.3, s: 11, size: 2, bars: grown }]);
    expect(lastBar(first).volume).toBe(4);
    expect(lastBar(second).volume).toBe(52);
  });
});

describe('intradayBucketMs', () => {
  it('returns the bucket size for intraday timeframes only', () => {
    expect(intradayBucketMs('5Min')).toBe(300_000);
    expect(intradayBucketMs('1Day')).toBeUndefined();
    expect(intradayBucketMs('constructor')).toBeUndefined();
  });
});
