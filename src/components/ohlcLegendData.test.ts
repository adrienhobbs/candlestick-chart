import { describe, it, expect } from 'vitest';
import { buildOhlcLegendData } from './ohlcLegendData';

describe('buildOhlcLegendData', () => {
  it('computes change abs + pct from open→close', () => {
    const out = buildOhlcLegendData({
      time: 1700000000,
      ohlc: { open: 100, high: 110, low: 95, close: 105 },
      volume: 4200,
      indicators: [],
    });
    expect(out).not.toBeNull();
    expect(out!.changeAbs).toBeCloseTo(5, 10);
    expect(out!.changePct).toBeCloseTo(5, 10); // (105-100)/100*100
    expect(out!.volume).toBe(4200);
  });

  it('handles a down bar (negative change)', () => {
    const out = buildOhlcLegendData({
      time: 1,
      ohlc: { open: 50, high: 51, low: 40, close: 45 },
      volume: null,
      indicators: [],
    });
    expect(out!.changeAbs).toBeCloseTo(-5, 10);
    expect(out!.changePct).toBeCloseTo(-10, 10);
    expect(out!.volume).toBeNull();
  });

  it('avoids divide-by-zero when open is 0', () => {
    const out = buildOhlcLegendData({
      time: 1,
      ohlc: { open: 0, high: 1, low: 0, close: 1 },
      volume: 0,
      indicators: [],
    });
    expect(out!.changePct).toBe(0);
  });

  it('returns null when there is no OHLC bar (e.g. a whitespace point)', () => {
    expect(buildOhlcLegendData({ time: 1, ohlc: null, volume: null, indicators: [] })).toBeNull();
  });

  it('passes indicator rows through', () => {
    const out = buildOhlcLegendData({
      time: 1,
      ohlc: { open: 1, high: 2, low: 1, close: 2 },
      volume: 1,
      indicators: [{ label: 'EMA', color: '#10b981', value: 1.5 }],
    });
    expect(out!.indicators).toEqual([{ label: 'EMA', color: '#10b981', value: 1.5 }]);
  });
});
