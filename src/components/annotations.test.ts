import { describe, expect, it } from 'vitest';
import { layoutPillRows, layoutPillTops, spreadSameBar } from './annotations-layout';
import { buildChartMarkers, buildTradeMarkers, buildTradePriceMarkers, isCustomDrawnMarker } from './trade-markers';
import type { ChartMarker, ChartTrade } from '../types/chart';

const T0 = Date.UTC(2026, 9, 15, 15, 30);
const MIN5 = 5 * 60_000;

describe('layoutPillRows', () => {
  it('keeps separate pills on the first row and stacks overlapping ones', () => {
    // Placed left to right: 0 (x 100) row 0; 3 (x 110) overlaps it, row 1; 1 (x 120)
    // overlaps both, row 2; 2 (x 400) is clear, back to row 0.
    const rows = layoutPillRows([
      { x: 100, width: 80 },
      { x: 120, width: 80 },
      { x: 400, width: 80 },
      { x: 110, width: 80 },
    ]);
    expect(rows).toEqual([0, 2, 0, 1]);
  });

  it('caps the rows instead of marching down over the candles', () => {
    const rows = layoutPillRows([0, 1, 2, 3, 4].map(() => ({ x: 100, width: 50 })), 4, 3);
    expect(Math.max(...rows)).toBe(2);
  });
});

describe('layoutPillTops', () => {
  const m = { top: 4, height: 16, rowGap: 3, inset: 2 };

  it('without a keep-out box, matches the row layout from the top edge', () => {
    expect(layoutPillTops([{ x: 100, width: 80 }, { x: 110, width: 80 }], null, m)).toEqual([4, 23]);
  });

  it('drops pills under the legend below it and leaves the rest on the top edge', () => {
    const tops = layoutPillTops(
      [
        { x: 60, width: 40 }, // under the legend (right edge 200)
        { x: 400, width: 40 }, // clear of it
        { x: 70, width: 40 }, // under it, overlapping the first
        { x: 10, width: 40 }, // clamped to the inset, still under it
      ],
      { right: 200, bottom: 50 },
      m,
    );
    expect(tops).toEqual([53, 4, 72, 53]);
  });
});

describe('spreadSameBar', () => {
  it('centres marks that share a bar and leaves a lone mark where it is', () => {
    expect(spreadSameBar([T0, T0, T0 + MIN5, T0], 10)).toEqual([-10, 0, 0, 10]);
  });
});

describe('custom-drawn markers', () => {
  const marker = (over: Partial<ChartMarker>): ChartMarker => ({ id: 'm', time: T0, price: 100, color: '#06b6d4', ...over });

  it('routes ▶/◀ and hollow marks away from lightweight-charts series markers', () => {
    expect(isCustomDrawnMarker(marker({ shape: 'arrowRight' }))).toBe(true);
    expect(isCustomDrawnMarker(marker({ shape: 'arrowLeft' }))).toBe(true);
    expect(isCustomDrawnMarker(marker({ hollow: true }))).toBe(true);
    expect(isCustomDrawnMarker(marker({ shape: 'square' }))).toBe(false);
    const out = buildChartMarkers(
      [marker({ id: 'a', shape: 'arrowRight' }), marker({ id: 'b', hollow: true }), marker({ id: 'c', shape: 'square' })],
      [T0],
    );
    expect(out.map((m) => m.id)).toEqual(['c']);
  });
});

describe('markerStyle: price', () => {
  const trade = (over: Partial<ChartTrade>): ChartTrade => ({
    id: 't1', entryTime: T0, exitTime: T0 + 36 * MIN5, entryPrice: 330.12, exitPrice: 331.01, outcome: 'win', ...over,
  });

  it('draws ▶ at the entry price and ◀ at the exit price instead of the arrows', () => {
    expect(buildTradeMarkers([trade({ markerStyle: 'price' })], null)).toEqual([]);
    expect(buildTradeMarkers([trade({})], null)).toHaveLength(2);
    const marks = buildTradePriceMarkers([trade({ markerStyle: 'price' }), trade({ id: 't2' })], { win: '#0f0', loss: '#f00' });
    expect(marks).toEqual([
      { id: 'trade:t1:entry', time: T0, price: 330.12, shape: 'arrowRight', color: '#0f0' },
      { id: 'trade:t1:exit', time: T0 + 36 * MIN5, price: 331.01, shape: 'arrowLeft', color: '#0f0' },
    ]);
  });
});
