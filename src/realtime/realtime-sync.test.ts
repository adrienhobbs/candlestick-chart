import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../types/chart';
import { planBarsSync } from '../components/bars-sync-plan';
import { applyBarsSync } from '../components/bars-sync-apply';
import { foldTick } from './fold';
import type { LiveFoldState } from './types';

const T0 = Date.parse('2026-10-30T16:25:00Z');
const REST: OHLCVBar[] = [
  { timestamp: T0 - 300_000, open: 99, high: 100.1, low: 98.9, close: 100, volume: 5 },
  { timestamp: T0, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 },
];

describe('realtime → series', () => {
  it('in-bucket ticks and rollovers reach the series through update() only', () => {
    const counts = { set: 0, update: 0 };
    const candle = { setData: () => void counts.set++, update: () => void counts.update++ };
    const volume = { setData: () => undefined, update: () => undefined };
    let prev: OHLCVBar[] = [];
    const push = (bars: OHLCVBar[]) => {
      applyBarsSync(planBarsSync(prev, bars), prev, bars, candle, volume, { volumeUpColor: 'u', volumeDownColor: 'd' });
      prev = bars;
    };
    push(REST);
    let state: LiveFoldState | null = null;
    for (const [price, s] of [[100.5, 10], [100.7, 200], [100.6, 301], [100.9, 302], [101, 601], [100.8, 902]]) {
      const out = foldTick(state, { key: 'XYZ', bars: REST, timeframe: '5Min', tick: { price, time: T0 + s * 1000 } });
      state = out.state;
      push(out.bars);
    }
    expect(counts.set).toBe(1); // the initial load only
    expect(counts.update).toBeGreaterThanOrEqual(6);
  });
});
