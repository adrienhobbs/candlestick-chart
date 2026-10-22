import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../../types/chart';
import { swingPoints, SwingPointsIndicator } from './swingpoints';

// One bar per entry: [high, low]; timestamps one minute apart (ms).
const bars = (hl: Array<[number, number]>): OHLCVBar[] =>
  hl.map(([high, low], i) => ({ timestamp: (i + 1) * 60_000, open: low, high, low, close: high, volume: 1 }));

describe('swingPoints', () => {
  it('marks the pivot bar itself, not its confirmation bar', () => {
    //            0        1        2        3         4        5        6
    const out = swingPoints(bars([[10, 5], [11, 6], [12, 7], [15, 9], [12, 7], [11, 3], [12, 4]]), 2);
    expect(out.map((o) => o.high)).toEqual([NaN, NaN, NaN, 15, NaN, NaN, NaN]);
    expect(out[3].time).toBe(240); // bar 3, in seconds
    // Bar 5's low (3) is the lowest around, but only 1 bar follows it: not confirmed yet.
    expect(out.every((o) => Number.isNaN(o.low))).toBe(true);
  });

  it('finds lows, and an equal neighbour is not a pivot', () => {
    const out = swingPoints(bars([[10, 5], [10, 4], [10, 2], [10, 4], [10, 5], [10, 2], [10, 6]]), 1);
    expect(out.map((o) => o.low)).toEqual([NaN, NaN, 2, NaN, NaN, 2, NaN]);
    // Flat highs: nothing strictly above its neighbours.
    expect(out.every((o) => Number.isNaN(o.high))).toBe(true);
  });

  it('never marks the first or last `strength` bars, and handles short series', () => {
    const out = swingPoints(bars([[1, 1], [9, 0], [1, 1]]), 2);
    expect(out.every((o) => Number.isNaN(o.high) && Number.isNaN(o.low))).toBe(true);
    expect(swingPoints([], 3)).toEqual([]);
  });

  it('floors strength to at least 1', () => {
    const out = swingPoints(bars([[1, 1], [9, 0], [1, 1]]), 0);
    expect(out[1]).toMatchObject({ high: 9, low: 0 });
  });

  it('is a POINTS definition drawing the high and low fields', () => {
    expect(SwingPointsIndicator.renderConfig).toMatchObject({ seriesType: 'points', pointFields: ['high', 'low'] });
    expect(SwingPointsIndicator.calculate(bars([[1, 1], [9, 0], [1, 1], [1, 1]]), { strength: 1 })[1].high).toBe(9);
  });
});
