import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../types/chart';
import { applyBarsSync } from './bars-sync-apply';

const THEME = { volumeUpColor: 'up', volumeDownColor: 'down' };
const bar = (t: number, close = 100): OHLCVBar => ({ timestamp: t, open: 100, high: 101, low: 99, close, volume: 10 });

function sinks() {
  const calls: string[] = [];
  const candle = { setData: (d: unknown[]) => calls.push(`set:${d.length}`), update: (d: { time: unknown }) => calls.push(`update:${String(d.time)}`) };
  const volume = { setData: () => undefined, update: () => undefined };
  return { calls, candle, volume };
}

describe('applyBarsSync', () => {
  it('set replaces everything', () => {
    const s = sinks();
    applyBarsSync('set', [], [bar(0), bar(300_000)], s.candle, s.volume, THEME);
    expect(s.calls).toEqual(['set:2']);
  });
  it('update sends the last bar', () => {
    const s = sinks();
    applyBarsSync('update', [bar(0)], [bar(0, 101)], s.candle, s.volume, THEME);
    expect(s.calls).toEqual(['update:0']);
  });
  it('append updates the changed old last bar, then the new bar', () => {
    const s = sinks();
    applyBarsSync('append', [bar(0)], [bar(0, 101), bar(300_000)], s.candle, s.volume, THEME);
    expect(s.calls).toEqual(['update:0', 'update:300']);
    const t = sinks();
    applyBarsSync('append', [bar(0)], [bar(0), bar(300_000)], t.candle, t.volume, THEME);
    expect(t.calls).toEqual(['update:300']);
  });
  it('none does nothing', () => {
    const s = sinks();
    applyBarsSync('none', [bar(0)], [bar(0)], s.candle, s.volume, THEME);
    expect(s.calls).toEqual([]);
  });
});
