import { describe, it, expect } from 'vitest';
import type { OHLCVBar } from '../types/chart';
import { planBarsSync, type BarsSyncPlan } from '../components/bars-sync-plan';
import { applyBarsSync } from '../components/bars-sync-apply';
import { foldTick } from './fold';
import type { LiveFoldState } from './types';

const T0 = Date.parse('2026-10-30T16:25:00Z');
const REST: OHLCVBar[] = [
  { timestamp: T0 - 300_000, open: 99, high: 100.1, low: 98.9, close: 100, volume: 5 },
  { timestamp: T0, open: 100, high: 100.4, low: 99.8, close: 100.2, volume: 1 },
];

/** Mimics lightweight-charts: update() replaces the last item at its time, appends a newer one, rejects an older one. */
function strictSeries<T extends { time: unknown }>() {
  const counts = { set: 0, update: 0 };
  let data: T[] = [];
  return {
    counts,
    data: () => data,
    setData(items: T[]) {
      counts.set++;
      data = [...items];
    },
    update(item: T) {
      counts.update++;
      const last = data[data.length - 1];
      if (last !== undefined && Number(item.time) < Number(last.time)) {
        throw new Error(`update at ${String(item.time)} is older than the last bar ${String(last.time)}`);
      }
      if (last !== undefined && Number(item.time) === Number(last.time)) data = [...data.slice(0, -1), item];
      else data = [...data, item];
    },
  };
}

describe('realtime → series', () => {
  it('in-bucket ticks and rollovers reach the series through update() only', () => {
    const candle = strictSeries<{ time: unknown }>();
    const volume = strictSeries<{ time: unknown }>();
    const plans: BarsSyncPlan[] = [];
    let prev: OHLCVBar[] = [];
    const push = (bars: OHLCVBar[]) => {
      const plan = planBarsSync(prev, bars);
      plans.push(plan);
      applyBarsSync(plan, prev, bars, candle as never, volume as never, { volumeUpColor: 'u', volumeDownColor: 'd' });
      prev = bars;
    };
    push(REST);
    let state: LiveFoldState | null = null;
    for (const [price, s] of [[100.5, 10], [100.7, 200], [100.6, 301], [100.9, 302], [101, 601], [100.8, 902]]) {
      const out = foldTick(state, { key: 'XYZ', bars: REST, timeframe: '5Min', tick: { price, time: T0 + s * 1000 } });
      state = out.state;
      push(out.bars);
    }
    expect(plans).toEqual(['set', 'update', 'update', 'append', 'update', 'append', 'append']);
    expect(candle.counts.set).toBe(1); // the initial load only
    expect(candle.data()).toEqual(
      prev.map((b) => ({ time: b.timestamp / 1000, open: b.open, high: b.high, low: b.low, close: b.close })),
    );
    expect(volume.data().map((v) => v.time)).toEqual(prev.map((b) => b.timestamp / 1000));
  });
});
