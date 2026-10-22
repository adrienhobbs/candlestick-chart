import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ISeriesMarkersPluginApi, SeriesMarker, Time } from 'lightweight-charts';
import type { OHLCVBar } from '../../types/chart';
import { indicatorRegistry } from '../../indicators/core/registry';
import { indicatorCalculator } from '../../indicators/core/calculator';
import { ChartSeriesType, type IndicatorInstance } from '../../indicators/core/types';
import { SwingPointsIndicator } from '../../indicators/registry/swingpoints';

// A markers plugin that records what it holds and whether it was detached.
interface FakePlugin {
  series: unknown;
  current: SeriesMarker<Time>[];
  detached: boolean;
  setMarkers: (m: SeriesMarker<Time>[]) => void;
  markers: () => SeriesMarker<Time>[];
  detach: () => void;
}
const plugins: FakePlugin[] = [];

vi.mock('lightweight-charts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lightweight-charts')>();
  return {
    ...actual,
    createSeriesMarkers: (series: unknown, markers: SeriesMarker<Time>[] = []) => {
      const plugin: FakePlugin = {
        series,
        current: markers,
        detached: false,
        setMarkers(m) {
          this.current = m;
        },
        markers() {
          return this.current;
        },
        detach() {
          this.detached = true;
        },
      };
      plugins.push(plugin);
      return plugin;
    },
  };
});

// Imported after the mock is registered.
const { createSeriesMarkers } = await import('lightweight-charts');
const { useIndicatorSeries } = await import('./useIndicatorSeries');

// A swing high at bar 2 and a swing low at bar 5 (strength 1).
const bars: OHLCVBar[] = [
  [10, 5], [11, 6], [14, 7], [12, 6], [11, 4], [10, 2], [11, 3],
].map(([high, low], i) => ({ timestamp: (i + 1) * 60_000, open: low, high, low, close: high, volume: 1 }));

const swing: IndicatorInstance = {
  id: 'swingpoints-1',
  definitionId: 'swingpoints',
  name: 'Swing Points(1)',
  settings: { strength: 1, highColor: '#f0f', lowColor: '#0ff', pointSize: 1 },
};

function setup() {
  const candles = { kind: 'candles' };
  const chart = { addSeries: vi.fn(), removeSeries: vi.fn() };
  // The chart's own trade/host markers plugin (useChartLifecycle creates it).
  const tradeMarkers = createSeriesMarkers(candles as never, [
    { time: 60 as Time, position: 'aboveBar', shape: 'arrowDown', color: '#000' },
  ]) as unknown as FakePlugin;
  const refs = {
    chartRef: { current: chart as never },
    candlestickSeriesRef: { current: candles as never },
    barsRef: { current: bars },
    indicatorSeriesRef: { current: new Map() },
    indicatorMarkersRef: { current: new Map<string, ISeriesMarkersPluginApi<Time>>() },
    indicatorPaneIndexRef: { current: new Map<string, number>() },
    nextPaneIndexRef: { current: 2 },
  };
  const hook = renderHook(
    ({ indicators }: { indicators: IndicatorInstance[] }) => useIndicatorSeries({ ...refs, indicators, bars }),
    { initialProps: { indicators: [swing] } },
  );
  return { candles, chart, tradeMarkers, refs, hook };
}

describe('useIndicatorSeries — POINTS', () => {
  beforeEach(() => {
    plugins.length = 0;
    indicatorRegistry.clear();
    indicatorCalculator.invalidateCache();
    indicatorRegistry.register(SwingPointsIndicator);
  });

  it('draws each point field as its own markers plugin on the candles, never a series', () => {
    const { candles, chart, refs } = setup();
    expect(chart.addSeries).not.toHaveBeenCalled();
    expect([...refs.indicatorMarkersRef.current.keys()]).toEqual(['swingpoints-1:high', 'swingpoints-1:low']);
    const high = refs.indicatorMarkersRef.current.get('swingpoints-1:high') as unknown as FakePlugin;
    const low = refs.indicatorMarkersRef.current.get('swingpoints-1:low') as unknown as FakePlugin;
    expect(high.series).toBe(candles);
    expect(high.current).toEqual([
      { time: 180, shape: 'circle', color: '#f0f', size: 1, position: 'atPriceMiddle', price: 14 },
    ]);
    expect(low.current).toEqual([
      { time: 360, shape: 'circle', color: '#0ff', size: 1, position: 'atPriceMiddle', price: 2 },
    ]);
  });

  it('detaches the points when the indicator is removed and leaves the trade markers alone', () => {
    const { tradeMarkers, refs, hook } = setup();
    const before = [...tradeMarkers.current];
    const pointPlugins = [...refs.indicatorMarkersRef.current.values()] as unknown as FakePlugin[];

    hook.rerender({ indicators: [] });

    expect(pointPlugins.every((p) => p.detached)).toBe(true);
    expect(refs.indicatorMarkersRef.current.size).toBe(0);
    expect(tradeMarkers.detached).toBe(false);
    expect(tradeMarkers.current).toEqual(before);
  });

  it('replaces the plugins when settings change, still leaving the trade markers alone', () => {
    const { tradeMarkers, refs, hook } = setup();
    const first = refs.indicatorMarkersRef.current.get('swingpoints-1:high') as unknown as FakePlugin;

    hook.rerender({ indicators: [{ ...swing, settings: { ...swing.settings, highColor: '#123456' } }] });

    const next = refs.indicatorMarkersRef.current.get('swingpoints-1:high') as unknown as FakePlugin;
    expect(first.detached).toBe(true);
    expect(next).not.toBe(first);
    expect(next.current[0].color).toBe('#123456');
    expect(tradeMarkers.detached).toBe(false);
    expect(tradeMarkers.current).toHaveLength(1);
  });

  it('a single-output POINTS indicator uses `value` and the instance color', () => {
    indicatorRegistry.register({
      metadata: { id: 'dots', name: 'Dots', description: '', category: SwingPointsIndicator.metadata.category, version: '1.0.0' },
      settings: {},
      renderConfig: { seriesType: ChartSeriesType.POINTS, outputCount: 1, overlay: true, pointShape: 'square', pointPosition: 'belowBar' },
      calculate: (b) => b.map((bar, i) => ({ time: bar.timestamp / 1000, value: i % 3 === 0 ? bar.low : NaN })),
    });
    const { refs, hook } = setup();
    hook.rerender({ indicators: [{ id: 'dots-1', definitionId: 'dots', name: 'Dots(1)', settings: { color: '#abc' } }] });
    const dots = refs.indicatorMarkersRef.current.get('dots-1:value') as unknown as FakePlugin;
    expect(dots.current.map((m) => [m.time, m.position, m.shape, m.color])).toEqual([
      [60, 'belowBar', 'square', '#abc'],
      [240, 'belowBar', 'square', '#abc'],
      [420, 'belowBar', 'square', '#abc'],
    ]);
  });
});
