import { describe, it, expect } from 'vitest';
import { planBarsSync } from './bars-sync-plan';
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
