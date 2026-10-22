import { describe, it, expect } from 'vitest';
import { ChartSeriesType, type IndicatorOutput, type RenderConfig } from '../indicators/core/types';
import { buildIndicatorPointMarkers, pointFieldsOf, resolvePointStyle } from './indicator-points';

const points = (cfg: Partial<RenderConfig> = {}): RenderConfig => ({
  seriesType: ChartSeriesType.POINTS,
  outputCount: 1,
  overlay: true,
  ...cfg,
});

const data: IndicatorOutput[] = [
  { time: 300, value: 12 },
  { time: 100, value: 10 },
  { time: 200, value: NaN },
  { time: 400, value: Infinity },
];

describe('resolvePointStyle', () => {
  it('defaults to a size-1 circle at the price', () => {
    expect(resolvePointStyle(points(), {})).toEqual({ shape: 'circle', position: 'atPrice', size: 1 });
  });

  it('uses the renderConfig, overridden by valid same-named settings', () => {
    const cfg = points({ pointShape: 'square', pointPosition: 'aboveBar', pointSize: 2 });
    expect(resolvePointStyle(cfg, {})).toEqual({ shape: 'square', position: 'aboveBar', size: 2 });
    expect(resolvePointStyle(cfg, { pointShape: 'arrowUp', pointPosition: 'belowBar', pointSize: 3 })).toEqual({
      shape: 'arrowUp',
      position: 'belowBar',
      size: 3,
    });
    expect(resolvePointStyle(cfg, { pointShape: 'star', pointPosition: 'left', pointSize: -1 })).toEqual({
      shape: 'square',
      position: 'aboveBar',
      size: 2,
    });
  });
});

describe('pointFieldsOf', () => {
  it('draws `value` for a single output, every field for many, or the listed fields', () => {
    expect(pointFieldsOf(points(), [{ time: 1, value: 1, other: 2 }])).toEqual(['value']);
    expect(pointFieldsOf(points({ outputCount: 2 }), [{ time: 1, value: 1, low: 2 }])).toEqual(['value', 'low']);
    expect(pointFieldsOf(points({ outputCount: 2, pointFields: ['high', 'low'] }), [])).toEqual(['high', 'low']);
  });
});

describe('buildIndicatorPointMarkers', () => {
  it('skips non-finite values and maps the rest to price markers, sorted by time', () => {
    const markers = buildIndicatorPointMarkers(data, 'value', { shape: 'square', position: 'atPrice', size: 2 }, '#f00');
    expect(markers).toEqual([
      { time: 100, shape: 'square', color: '#f00', size: 2, position: 'atPriceMiddle', price: 10 },
      { time: 300, shape: 'square', color: '#f00', size: 2, position: 'atPriceMiddle', price: 12 },
    ]);
  });

  it('places bar-positioned markers without a price', () => {
    const [first] = buildIndicatorPointMarkers(data, 'value', { shape: 'arrowDown', position: 'aboveBar', size: 1 }, '#0f0');
    expect(first).toEqual({ time: 100, shape: 'arrowDown', color: '#0f0', size: 1, position: 'aboveBar' });
    expect('price' in first).toBe(false);
  });

  it('reads the named field and treats a missing field as no point', () => {
    const rows: IndicatorOutput[] = [{ time: 1, value: NaN, low: 5 }, { time: 2, value: NaN }];
    expect(buildIndicatorPointMarkers(rows, 'low', { shape: 'circle', position: 'atPrice', size: 1 }, '#00f')).toHaveLength(1);
  });
});
