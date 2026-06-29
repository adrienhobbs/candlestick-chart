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

describe('calculateRSI', () => {
  it('all-gains series → 100 at fully-formed indices; leading values NaN', () => {
    const out = calculateRSI(barsFromCloses([1, 2, 3, 4, 5, 6]), 3);
    expect(out.length).toBe(6);
    // i < period are NaN
    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeNaN();
    // strictly increasing → no losses → RSI pinned at 100 once the window is fully formed
    expect(out[4]).toBe(100);
    expect(out[5]).toBe(100);
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
