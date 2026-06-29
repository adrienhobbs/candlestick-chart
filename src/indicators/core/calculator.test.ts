import { describe, it, expect, beforeEach } from 'vitest';
import type { OHLCVBar } from '../../types/chart';
import { indicatorRegistry } from './registry';
import { indicatorCalculator } from './calculator';
import { IndicatorCategory, ChartSeriesType, type IndicatorDefinition, type IndicatorInstance } from './types';

const bars = (n: number): OHLCVBar[] =>
  Array.from({ length: n }, (_, i) => ({
    timestamp: 1_700_000_000_000 + i * 1000,
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

  it('returns [] for an unknown definition (no throw)', () => {
    const out = indicatorCalculator.calculate(
      { id: 'ghost-1', definitionId: 'ghost', name: 'Ghost', settings: {} },
      bars(3),
    );
    expect(out).toEqual([]);
  });
});
