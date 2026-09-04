import { describe, it, expect, beforeEach } from 'vitest';
import type { OHLCVBar } from '../../types/chart';
import { indicatorRegistry } from './registry';
import { indicatorCalculator } from './calculator';
import { IndicatorCategory, ChartSeriesType, type IndicatorDefinition, type IndicatorInstance } from './types';

const bars = (n: number, startMs = 1_700_000_000_000): OHLCVBar[] =>
  Array.from({ length: n }, (_, i) => ({
    timestamp: startMs + i * 1000,
    open: 1,
    high: 1,
    low: 1,
    close: 1 + i,
    volume: 100,
  }));

let calls = 0;
const def: IndicatorDefinition = {
  metadata: {
    id: 'calc-test',
    name: 'Calc Test',
    description: 'counts calculate() invocations',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: { type: 'number', label: 'Period', defaultValue: 5, min: 1, max: 100, step: 1 },
  },
  renderConfig: { seriesType: ChartSeriesType.LINE, outputCount: 1, overlay: true },
  calculate: (b, settings) => {
    calls++;
    return b.map((bar) => ({ time: bar.timestamp / 1000, value: settings.period }));
  },
};

const instance = (settings: Record<string, unknown>): IndicatorInstance => ({
  id: 'calc-test-1',
  definitionId: 'calc-test',
  name: 'Calc Test(1)',
  settings,
});

describe('indicatorCalculator', () => {
  beforeEach(() => {
    calls = 0;
    indicatorRegistry.register(def);
    indicatorCalculator.invalidateCache();
  });

  it('cache HIT: same instance + same settings + same data length returns the cached array (no recompute)', () => {
    const inst = instance({ period: 5 });
    const data = bars(10);
    const first = indicatorCalculator.calculate(inst, data);
    const second = indicatorCalculator.calculate(inst, data);
    expect(calls).toBe(1);
    expect(second).toBe(first); // same reference → served from cache
  });

  it('cache MISS: changed settings hash recomputes', () => {
    const data = bars(10);
    indicatorCalculator.calculate(instance({ period: 5 }), data);
    indicatorCalculator.calculate(instance({ period: 9 }), data);
    expect(calls).toBe(2);
  });

  it('cache MISS: changed data length recomputes', () => {
    const inst = instance({ period: 5 });
    indicatorCalculator.calculate(inst, bars(10));
    indicatorCalculator.calculate(inst, bars(11));
    expect(calls).toBe(2);
  });

  it('cache MISS: same bar COUNT but a different series recomputes (symbol/window swap)', () => {
    // The regression this guards: paging by a fixed limit means a different
    // symbol arrives with an identical bar count, and a count-keyed cache would
    // serve the previous symbol's values over the new symbol's candles.
    const inst = instance({ period: 5 });
    indicatorCalculator.calculate(inst, bars(500));
    indicatorCalculator.calculate(inst, bars(500, 1_900_000_000_000));
    expect(calls).toBe(2);
  });

  it('cache MISS: the last bar mutating in place recomputes (live tick)', () => {
    // A live bar updates its price while KEEPING its timestamp, so neither the
    // count nor the endpoints move — only the last bar's OHLCV.
    const inst = instance({ period: 5 });
    const data = bars(10);
    indicatorCalculator.calculate(inst, data);
    const ticked = data.map((b, i) =>
      i === data.length - 1 ? { ...b, close: b.close + 1, high: b.high + 1 } : b,
    );
    indicatorCalculator.calculate(inst, ticked);
    expect(calls).toBe(2);
  });

  it('cache HIT: an equal-valued copy of the same series is still served from cache', () => {
    // Identity is the DATA, not the array reference — re-deriving the same bars
    // (a new array each render) must not force a recompute.
    const inst = instance({ period: 5 });
    indicatorCalculator.calculate(inst, bars(10));
    const second = indicatorCalculator.calculate(inst, bars(10));
    expect(calls).toBe(1);
    expect(second).toHaveLength(10);
  });

  it('handles an empty series without throwing, and recomputes once bars arrive', () => {
    const inst = instance({ period: 5 });
    expect(indicatorCalculator.calculate(inst, [])).toEqual([]);
    indicatorCalculator.calculate(inst, bars(10));
    expect(calls).toBe(2);
  });

  it('returns [] for an unknown definition (no throw)', () => {
    const out = indicatorCalculator.calculate(
      { id: 'ghost-1', definitionId: 'ghost', name: 'Ghost', settings: {} },
      bars(3),
    );
    expect(out).toEqual([]);
  });
});
