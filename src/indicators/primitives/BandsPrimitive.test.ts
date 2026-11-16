import { describe, it, expect, vi } from 'vitest';
import type { LineData, Time } from 'lightweight-charts';
import { BandsPrimitive } from './BandsPrimitive';

const SPACING = 10;
const WIDTH = 100;

type Line = LineData<Time>[];
const line = (n: number, value: (i: number) => number, skip: (i: number) => boolean = () => false): Line =>
  Array.from({ length: n }, (_, i) => i)
    .filter((i) => !skip(i))
    .map((i) => ({ time: (1000 + i * 60) as Time, value: value(i) }));

function fakeSeries(data: Line) {
  const handlers = new Set<() => void>();
  return {
    current: data,
    handlers,
    data: vi.fn(function (this: { current: Line }) {
      return this.current.map((d) => ({ ...d }));
    }),
    priceToCoordinate: vi.fn((p: number) => 500 - p),
    subscribeDataChanged: (h: () => void) => handlers.add(h),
    unsubscribeDataChanged: (h: () => void) => handlers.delete(h),
    change(next: Line) {
      this.current = next;
      handlers.forEach((h) => h());
    },
  };
}

/** A time scale showing bars [first, first + WIDTH / SPACING) of `n`, one bar every SPACING px. */
function fakeChart(n: number) {
  const view = { first: 0 };
  const timeOf = (i: number) => 1000 + i * 60;
  const timeScale = {
    width: () => WIDTH,
    timeToCoordinate: vi.fn((t: number) => ((t - 1000) / 60 - view.first) * SPACING + SPACING / 2),
    getVisibleRange: () => {
      const last = Math.min(n - 1, view.first + WIDTH / SPACING - 1);
      return view.first > n - 1 ? null : { from: timeOf(view.first), to: timeOf(last) };
    },
  };
  return { view, timeScale, chart: { timeScale: () => timeScale } };
}

function setup(n: number, upperData: Line, lowerData: Line) {
  const upper = fakeSeries(upperData);
  const lower = fakeSeries(lowerData);
  const { view, timeScale, chart } = fakeChart(n);
  const primitive = new BandsPrimitive({ upperSeries: upper as never, lowerSeries: lower as never, fillColor: '#abc' });
  primitive.attached({ chart, series: upper, requestUpdate: () => {} } as never);
  const draw = () => {
    const calls: [string, ...number[]][] = [];
    const ctx = {
      fillStyle: '',
      save: () => {},
      restore: () => {},
      scale: () => {},
      beginPath: () => calls.push(['beginPath']),
      moveTo: (x: number, y: number) => calls.push(['moveTo', x, y]),
      lineTo: (x: number, y: number) => calls.push(['lineTo', x, y]),
      closePath: () => calls.push(['closePath']),
      fill: () => calls.push(['fill']),
    };
    const renderer = primitive.paneViews()[0].renderer();
    renderer.draw({
      useBitmapCoordinateSpace: (fn: (s: unknown) => void) => fn({ context: ctx, horizontalPixelRatio: 1, verticalPixelRatio: 1 }),
    } as never);
    return { calls, fillStyle: ctx.fillStyle };
  };
  return { upper, lower, view, timeScale, primitive, draw };
}

/** The pre-change algorithm: every time both bands have, converted, then drawn as one polygon. */
function fullPolygon(upper: Line, lower: Line, first: number) {
  const x = (t: number) => ((t - 1000) / 60 - first) * SPACING + SPACING / 2;
  const lowerByTime = new Map(lower.map((d) => [d.time as number, d.value]));
  return upper
    .filter((d) => lowerByTime.has(d.time as number))
    .map((d) => ({ x: x(d.time as number), y1: 500 - d.value, y2: 500 - (lowerByTime.get(d.time as number) as number) }));
}

/** `points` cut to the pane, keeping the nearest point beyond each edge so the fill reaches it. */
function clipToPane(points: { x: number; y1: number; y2: number }[]) {
  let a = 0;
  while (a + 1 < points.length && points[a + 1].x <= 0) a += 1;
  let b = points.length - 1;
  while (b - 1 >= 0 && points[b - 1].x >= WIDTH) b -= 1;
  return points.slice(a, b + 1);
}

function polygonCalls(points: { x: number; y1: number; y2: number }[]) {
  if (points.length === 0) return [];
  return [
    ['beginPath'],
    ['moveTo', points[0].x, points[0].y1],
    ...points.slice(1).map((p) => ['lineTo', p.x, p.y1]),
    ...[...points].reverse().map((p) => ['lineTo', p.x, p.y2]),
    ['closePath'],
    ['fill'],
  ];
}

describe('BandsPrimitive', () => {
  it('does no data read or coordinate conversion on a data change or view update', () => {
    const t = setup(5000, line(5000, (i) => 110 + i * 0.01), line(5000, (i) => 90 + i * 0.01));
    t.draw();
    t.upper.data.mockClear();
    t.lower.data.mockClear();
    t.timeScale.timeToCoordinate.mockClear();
    t.upper.priceToCoordinate.mockClear();

    t.upper.change(line(5000, (i) => 111 + i * 0.01));
    t.primitive.updateAllViews();

    expect(t.upper.data).not.toHaveBeenCalled();
    expect(t.lower.data).not.toHaveBeenCalled();
    expect(t.timeScale.timeToCoordinate).not.toHaveBeenCalled();
    expect(t.upper.priceToCoordinate).not.toHaveBeenCalled();
  });

  it('converts only the visible points plus one beyond each edge when drawing', () => {
    const t = setup(5000, line(5000, (i) => 110 + i), line(5000, (i) => 90 + i));
    t.view.first = 2500;
    t.primitive.updateAllViews();
    t.draw();
    expect(t.timeScale.timeToCoordinate).toHaveBeenCalledTimes(WIDTH / SPACING + 2);
    expect(t.upper.priceToCoordinate.mock.calls.length).toBe(WIDTH / SPACING + 2);
  });

  it('draws the full-range polygon clipped to the pane, with the fill colour', () => {
    const upper = line(200, (i) => 110 + Math.sin(i));
    const lower = line(200, (i) => 90 + Math.cos(i));
    const t = setup(200, upper, lower);
    t.view.first = 50;
    t.primitive.updateAllViews();
    const { calls, fillStyle } = t.draw();
    expect(calls).toEqual(polygonCalls(clipToPane(fullPolygon(upper, lower, 50))));
    expect(fillStyle).toBe('#abc');
  });

  it('skips times either band lacks, reaching past missing points at the edges', () => {
    // Upper lacks 47-49 and 60; lower lacks 61 and 63. Bars 50-59 are visible.
    const upper = line(200, (i) => 110 + i, (i) => (i >= 47 && i <= 49) || i === 60);
    const lower = line(200, (i) => 90 + i, (i) => i === 61 || i === 63);
    const t = setup(200, upper, lower);
    t.view.first = 50;
    t.primitive.updateAllViews();
    const { calls } = t.draw();
    const expected = clipToPane(fullPolygon(upper, lower, 50));
    expect(calls).toEqual(polygonCalls(expected));
    const xs = expected.map((p) => (p.x - SPACING / 2) / SPACING + 50);
    expect(xs).toEqual([46, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 62]);
  });

  it('recomputes on scroll from the cached data, and re-reads data only after a change', () => {
    const upper = line(300, (i) => 110 + i);
    const lower = line(300, (i) => 90 + i);
    const t = setup(300, upper, lower);
    t.draw();
    expect(t.upper.data).toHaveBeenCalledTimes(1);

    t.view.first = 120;
    t.primitive.updateAllViews();
    expect(t.draw().calls).toEqual(polygonCalls(clipToPane(fullPolygon(upper, lower, 120))));
    expect(t.upper.data).toHaveBeenCalledTimes(1);

    const moved = line(300, (i) => 120 + i);
    t.upper.change(moved);
    t.primitive.updateAllViews();
    expect(t.draw().calls).toEqual(polygonCalls(clipToPane(fullPolygon(moved, lower, 120))));
    expect(t.upper.data).toHaveBeenCalledTimes(2);
  });

  it('draws nothing when no bars are visible, and unsubscribes when detached', () => {
    const t = setup(10, line(10, () => 110), line(10, () => 90));
    t.view.first = 50;
    t.primitive.updateAllViews();
    expect(t.draw().calls).toEqual([]);
    t.primitive.detached();
    expect(t.upper.handlers.size).toBe(0);
    expect(t.lower.handlers.size).toBe(0);
  });
});
