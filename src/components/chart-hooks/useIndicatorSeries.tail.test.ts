import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { OHLCVBar } from '../../types/chart';
import { indicatorRegistry } from '../../indicators/core/registry';
import { indicatorCalculator } from '../../indicators/core/calculator';
import { ChartSeriesType, IndicatorCategory, type IndicatorInstance } from '../../indicators/core/types';
import { registerBuiltInIndicators } from '../../indicators/registry';
import { planBarsSync, type BarsSyncPlan } from '../bars-sync-plan';
import { useIndicatorSeries } from './useIndicatorSeries';

type Point = { time: number } & Record<string, unknown>;

/** Behaves like a lightweight-charts series: update() replaces an equal time, appends a newer one, throws on an older one. */
class StrictSeries {
  data: Point[] = [];
  setDataCalls = 0;
  updateCalls = 0;
  setData(d: Point[]) {
    this.setDataCalls += 1;
    this.data = d.map((p) => ({ ...p }));
  }
  update(p: Point) {
    this.updateCalls += 1;
    const last = this.data[this.data.length - 1];
    if (last !== undefined && p.time < last.time) throw new Error(`update at ${p.time} is older than ${last.time}`);
    if (last !== undefined && p.time === last.time) this.data[this.data.length - 1] = { ...p };
    else this.data.push({ ...p });
    // lightweight-charts 5 writes its own field onto the point passed to update().
    (p as Record<string, unknown>)._internal_originalTime = p.time;
  }
  attachPrimitive() {}
}

const MIN = 60_000;
const DAY1_START = Date.parse('2026-01-05T19:40:00Z'); // 14:40 ET; the last bar is 15:59 ET
const DAY2_OPEN = Date.parse('2026-01-06T14:30:00Z'); // 09:30 ET the next session

function bar(timestamp: number, close: number): OHLCVBar {
  return { timestamp, open: close - 0.1, high: close + 0.3, low: close - 0.4, close, volume: 1000 + (timestamp / MIN) % 97 };
}
const history = (): OHLCVBar[] => Array.from({ length: 80 }, (_, i) => bar(DAY1_START + i * MIN, 100 + Math.sin(i / 5) * 2));

function mount(indicators: IndicatorInstance[], bars: OHLCVBar[]) {
  const created: StrictSeries[] = [];
  const chart = {
    addSeries: () => {
      const s = new StrictSeries();
      created.push(s);
      return s;
    },
    removeSeries: () => {},
  };
  const refs = {
    chartRef: { current: chart as never },
    candlestickSeriesRef: { current: {} as never },
    barsRef: { current: bars },
    indicatorSeriesRef: { current: new Map() },
    indicatorMarkersRef: { current: new Map() },
    indicatorPaneIndexRef: { current: new Map<string, number>() },
    nextPaneIndexRef: { current: 2 },
    barsSyncPlanRef: { current: 'set' as BarsSyncPlan | null },
  };
  const hook = renderHook(
    (p: { bars: OHLCVBar[]; indicators: IndicatorInstance[] }) =>
      useIndicatorSeries({ ...refs, firstIndicatorPane: 2, indicators: p.indicators, bars: p.bars }),
    { initialProps: { bars, indicators } },
  );
  let current = bars;
  let currentIndicators = indicators;
  const feed = (next: OHLCVBar[]) => {
    refs.barsSyncPlanRef.current = planBarsSync(current, next);
    refs.barsRef.current = next;
    current = next;
    hook.rerender({ bars: next, indicators: currentIndicators });
  };
  const setIndicators = (next: IndicatorInstance[]) => {
    currentIndicators = next;
    hook.rerender({ bars: current, indicators: next });
  };
  return { created, feed, setIndicators, refs };
}

/** Tail ticks and rollovers, ending in the next session so VWAP resets. */
function liveSequence(start: OHLCVBar[]): OHLCVBar[][] {
  const steps: OHLCVBar[][] = [];
  let bars = start;
  const tick = (close: number) => {
    const last = bars[bars.length - 1];
    bars = [...bars.slice(0, -1), { ...last, close, high: Math.max(last.high, close), low: Math.min(last.low, close), volume: last.volume + 5 }];
    steps.push(bars);
  };
  const append = (timestamp: number, close: number) => {
    bars = [...bars, bar(timestamp, close)];
    steps.push(bars);
  };
  const last = () => bars[bars.length - 1];
  tick(last().close + 0.5);
  tick(last().close - 1.2);
  append(DAY2_OPEN, 103);
  tick(104.1);
  tick(102.7);
  append(DAY2_OPEN + MIN, 101.9);
  tick(100.4);
  append(DAY2_OPEN + 2 * MIN, 102.2);
  return steps;
}

const instance = (definitionId: string): IndicatorInstance => indicatorRegistry.createInstance(definitionId);

beforeEach(() => {
  indicatorRegistry.clear();
  indicatorCalculator.invalidateCache();
  registerBuiltInIndicators();
});

describe('useIndicatorSeries tail updates', () => {
  for (const id of ['ema', 'bollinger', 'rsi', 'macd', 'vwap']) {
    it(`${id}: live ticks and rollovers go through update() and match a full recompute`, () => {
      const indicators = [instance(id)];
      const live = mount(indicators, history());
      expect(live.created.length).toBeGreaterThan(0);
      const setDataBefore = live.created.map((s) => s.setDataCalls);

      const steps = liveSequence(history());
      for (const step of steps) live.feed(step);

      expect(live.created.map((s) => s.setDataCalls)).toEqual(setDataBefore);
      expect(live.created.every((s) => s.updateCalls > 0)).toBe(true);

      indicatorCalculator.invalidateCache();
      const full = mount(indicators, steps[steps.length - 1]);
      expect(live.created.map((s) => s.data)).toEqual(full.created.map((s) => s.data));
    });
  }

  it('a set plan (e.g. an older page loaded) still uses setData', () => {
    const bars = history();
    const live = mount([instance('ema')], bars.slice(20));
    live.feed(bars);
    expect(live.refs.barsSyncPlanRef.current).toBe('set');
    expect(live.created[0].setDataCalls).toBe(2);
    expect(live.created[0].updateCalls).toBe(0);
  });

  it('falls back to setData for a series whose earlier points changed', () => {
    indicatorRegistry.register({
      metadata: { id: 'lastclose', name: 'Last close', description: '', category: IndicatorCategory.TREND, version: '1.0.0' },
      settings: {},
      renderConfig: { seriesType: ChartSeriesType.LINE, outputCount: 1, overlay: true },
      calculate: (b) => b.map((x) => ({ time: x.timestamp / 1000, value: b[b.length - 1].close })),
    });
    const live = mount([instance('lastclose')], history());
    const steps = liveSequence(history());
    live.feed(steps[0]);
    expect(live.refs.barsSyncPlanRef.current).toBe('update');
    expect(live.created[0].setDataCalls).toBe(2);
    expect(live.created[0].updateCalls).toBe(0);
    expect(live.created[0].data.every((p) => p.value === steps[0][steps[0].length - 1].close)).toBe(true);
  });

  it('toggling an indicator off and on recreates it with setData', () => {
    const ema = instance('ema');
    const live = mount([ema], history());
    live.setIndicators([{ ...ema, enabled: false }]);
    live.setIndicators([{ ...ema, enabled: true }]);
    expect(live.created).toHaveLength(2);
    expect(live.created[1].setDataCalls).toBe(1);
    expect(live.created[1].updateCalls).toBe(0);
    live.feed(liveSequence(history())[0]);
    expect(live.created[1].setDataCalls).toBe(1);
    expect(live.created[1].updateCalls).toBe(1);
  });
});
