import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../../types/chart';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateStandardDeviation,
  calculateBollingerBands,
} from './calculations';

// Only `.close` matters to SMA/EMA/RSI/Bollinger; fill the rest with the close.
const barsFromCloses = (closes: number[]): OHLCVBar[] =>
  closes.map((c, i) => ({
    timestamp: 1_700_000_000_000 + i * 1000,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: 1000,
  }));

describe('calculateSMA', () => {
  it('leading NaN then trailing window averages (period 3 of [1,2,3,4,5])', () => {
    const out = calculateSMA(barsFromCloses([1, 2, 3, 4, 5]), 3);
    expect(out.length).toBe(5);
    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeCloseTo(2, 10); // (1+2+3)/3
    expect(out[3]).toBeCloseTo(3, 10); // (2+3+4)/3
    expect(out[4]).toBeCloseTo(4, 10); // (3+4+5)/3
  });
});

describe('calculateEMA', () => {
  it('seeds at index period-1 with the SMA, then recurses (period 3, multiplier 0.5)', () => {
    const out = calculateEMA(barsFromCloses([1, 2, 3, 4, 5]), 3);
    expect(out.length).toBe(5);
    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeCloseTo(2, 10); // SMA seed (1+2+3)/3
    expect(out[3]).toBeCloseTo(3, 10); // (4-2)*0.5 + 2
    expect(out[4]).toBeCloseTo(4, 10); // (5-3)*0.5 + 3
  });
});

describe('calculateRSI (Wilder)', () => {
  it('NaN before `period`; first RSI at index `period`', () => {
    const out = calculateRSI(barsFromCloses([1, 2, 3, 4, 5, 6]), 3);
    expect(out.length).toBe(6);
    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeNaN();
    // index === period is the FIRST valid value (was NaN under the old off-by-one).
    expect(Number.isNaN(out[3])).toBe(false);
  });

  it('all-gains → 100 from index `period` onward', () => {
    const out = calculateRSI(barsFromCloses([1, 2, 3, 4, 5, 6]), 3);
    expect(out[3]).toBe(100);
    expect(out[4]).toBe(100);
    expect(out[5]).toBe(100);
  });

  it('all-losses → 0 from index `period` onward', () => {
    const out = calculateRSI(barsFromCloses([6, 5, 4, 3, 2, 1]), 3);
    expect(out[3]).toBe(0);
    expect(out[4]).toBe(0);
    expect(out[5]).toBe(0);
  });

  it('Wilder smoothing — hand-computed [1,2,1,2] period 2', () => {
    // changes = [+1, -1, +1].
    // seed @ i=2: avgGain 0.5, avgLoss 0.5 → RS 1 → RSI 50.
    // i=3: gain 1,loss 0 → avgGain (0.5+1)/2=0.75, avgLoss 0.25 → RS 3 → RSI 75.
    const out = calculateRSI(barsFromCloses([1, 2, 1, 2]), 2);
    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeCloseTo(50, 10);
    expect(out[3]).toBeCloseTo(75, 10);
  });

  it('returns all-NaN when there are not enough bars', () => {
    const out = calculateRSI(barsFromCloses([1, 2, 3]), 5);
    expect(out.length).toBe(3);
    expect(out.every((v) => Number.isNaN(v))).toBe(true);
  });
});

describe('calculateStandardDeviation', () => {
  it('population standard deviation over the trailing window', () => {
    // mean of [2,4,4,4,5,5,7,9] = 5; population variance = 4; std = 2
    const out = calculateStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9], 8);
    expect(out.length).toBe(8);
    for (let i = 0; i < 7; i++) expect(out[i]).toBeNaN();
    expect(out[7]).toBeCloseTo(2, 10);
  });
});

describe('calculateBollingerBands', () => {
  it('middle is the SMA; bands are symmetric at ±stdDev*std', () => {
    const bars = barsFromCloses([1, 2, 3, 4, 5]);
    const { upper, middle, lower } = calculateBollingerBands(bars, 3, 2);
    expect(middle.length).toBe(5);
    // middle matches SMA
    expect(middle[4]).toBeCloseTo(4, 10);
    // std of [3,4,5] (period-3 window at i=4) = sqrt(2/3) ≈ 0.8164966
    const std = Math.sqrt(2 / 3);
    expect(upper[4]).toBeCloseTo(4 + 2 * std, 10);
    expect(lower[4]).toBeCloseTo(4 - 2 * std, 10);
    // leading values NaN
    expect(middle[0]).toBeNaN();
    expect(upper[0]).toBeNaN();
    expect(lower[0]).toBeNaN();
  });
});
