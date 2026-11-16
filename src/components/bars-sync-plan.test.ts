import { describe, it, expect } from 'vitest';
import { planBarsSync, sortedUniqueBars } from './bars-sync-plan';
import type { OHLCVBar } from '../types/chart';

const bar = (t: number, close = 100): OHLCVBar => ({ timestamp: t, open: 100, high: 101, low: 99, close, volume: 10 });
const series = (n: number, close = 100) => Array.from({ length: n }, (_, i) => bar(i * 300_000, close));

describe('planBarsSync', () => {
  it('first load sets; empty to empty is a no-op', () => {
    expect(planBarsSync([], series(3))).toBe('set');
    expect(planBarsSync([], [])).toBe('none');
  });

  it('a shorter, emptied or much longer series is set in full', () => {
    expect(planBarsSync(series(4), series(3))).toBe('set');
    expect(planBarsSync(series(4), [])).toBe('set');
    expect(planBarsSync(series(3), series(5))).toBe('set');
  });

  it('one bar appended after unchanged bars is an append, even if the old last bar changed', () => {
    const prev = series(3);
    expect(planBarsSync(prev, series(4))).toBe('append');
    const closedChanged = [...prev.slice(0, 2), { ...prev[2], close: 100.7 }, bar(3 * 300_000)];
    expect(planBarsSync(prev, closedChanged)).toBe('append');
  });

  it('an extra bar with an earlier bar changed, or a prepended bar, is set', () => {
    const prev = series(3);
    const earlierChanged = [{ ...prev[0], close: 1 }, prev[1], prev[2], bar(3 * 300_000)];
    expect(planBarsSync(prev, earlierChanged)).toBe('set');
    expect(planBarsSync(prev, [bar(-300_000), ...prev])).toBe('set');
  });

  it('a same-length series with different timestamps is set (a shifted window)', () => {
    const shifted = series(3).map((b) => ({ ...b, timestamp: b.timestamp + 300_000 }));
    expect(planBarsSync(series(3), shifted)).toBe('set');
  });

  it('a different series on the same timestamps is set, not patched at the last bar', () => {
    expect(planBarsSync(series(3, 100), series(3, 250))).toBe('set');
  });

  it('only the last bar changing is an update; identical bars are a no-op', () => {
    const prev = series(3);
    const ticked = [...prev.slice(0, 2), { ...prev[2], close: 100.5 }];
    expect(planBarsSync(prev, ticked)).toBe('update');
    expect(planBarsSync(prev, series(3))).toBe('none');
  });
});

describe('sortedUniqueBars', () => {
  it('returns a copy of bars that are already ascending and unique', () => {
    const bars = series(4);
    const out = sortedUniqueBars(bars);
    expect(out).toEqual(bars);
    expect(out).not.toBe(bars);
    out.push(bar(9e9));
    expect(bars).toHaveLength(4);
  });

  it('sorts unordered bars ascending', () => {
    const out = sortedUniqueBars([bar(600_000), bar(0), bar(300_000)]);
    expect(out.map((b) => b.timestamp)).toEqual([0, 300_000, 600_000]);
  });

  it('keeps the first of a duplicated timestamp, sorted or not', () => {
    expect(sortedUniqueBars([bar(0, 1), bar(300_000, 2), bar(300_000, 3)]).map((b) => b.close)).toEqual([1, 2]);
    expect(sortedUniqueBars([bar(300_000, 2), bar(0, 1), bar(300_000, 3)]).map((b) => b.close)).toEqual([1, 2]);
  });

  it('handles empty and single-bar input', () => {
    expect(sortedUniqueBars([])).toEqual([]);
    expect(sortedUniqueBars([bar(5)])).toEqual([bar(5)]);
  });
});

describe('sortedUniqueBars with NaN timestamps', () => {
  // The sort + filter useBarsSync ran before the ordered-input shortcut.
  const legacy = (bars: OHLCVBar[]) => {
    const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.filter((b, i) => i === 0 || b.timestamp !== sorted[i - 1].timestamp);
  };

  for (const [label, input] of [
    ['first', [bar(NaN, 1), bar(0, 2), bar(300_000, 3)]],
    ['in the middle', [bar(0, 1), bar(NaN, 2), bar(300_000, 3)]],
    ['last', [bar(0, 1), bar(300_000, 2), bar(NaN, 3)]],
    ['twice, unsorted', [bar(600_000, 1), bar(NaN, 2), bar(0, 3), bar(NaN, 4), bar(300_000, 5)]],
    ['alone', [bar(NaN, 1)]],
  ] as const) {
    it(`matches the old sort + filter with a NaN ${label}`, () => {
      expect(sortedUniqueBars([...input])).toEqual(legacy([...input]));
    });
  }
});
