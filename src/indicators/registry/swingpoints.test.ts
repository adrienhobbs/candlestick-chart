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

  it('plots at the confirmation bar, at the pivot price, when asked', () => {
    //            0        1        2        3         4        5        6
    const hl: Array<[number, number]> = [[10, 5], [11, 6], [12, 7], [15, 9], [12, 7], [11, 8], [12, 8]];
    const out = swingPoints(bars(hl), 2, 'confirmation');
    // Pivot at bar 3 is known once bar 5 closes: drawn on bar 5 at bar 3's high.
    expect(out.map((o) => o.high)).toEqual([NaN, NaN, NaN, NaN, NaN, 15, NaN]);
    expect(out[5].time).toBe(360);
    // The newest confirmable pivot lands on the last bar.
    const last = swingPoints(bars([[1, 1], [9, 0], [1, 1]]), 1, 'confirmation');
    expect(last[2]).toMatchObject({ high: 9, low: 0 });
  });

  it('reads plotAt from the settings', () => {
    const series = bars([[1, 1], [9, 0], [1, 1], [1, 1]]);
    expect(SwingPointsIndicator.calculate(series, { strength: 1, plotAt: 'confirmation' })[2].high).toBe(9);
    expect(SwingPointsIndicator.calculate(series, { strength: 1, plotAt: 'confirmation' })[1].high).toBeNaN();
    expect(SwingPointsIndicator.settings.plotAt.defaultValue).toBe('pivot');
  });

  it('is a POINTS definition drawing the high and low fields', () => {
    expect(SwingPointsIndicator.renderConfig).toMatchObject({ seriesType: 'points', pointFields: ['high', 'low'] });
    expect(SwingPointsIndicator.calculate(bars([[1, 1], [9, 0], [1, 1], [1, 1]]), { strength: 1 })[1].high).toBe(9);
  });
});
