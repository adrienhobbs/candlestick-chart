import { describe, it, expect, vi } from 'vitest';
import { SessionsPrimitive } from './SessionsPrimitive';
import { buildSessionRuns, detectDayBoundaries, US_EQUITY_PRESET, type SessionsConfig } from '../../sessions/sessions';

const SPACING = 8;
const WIDTH = 400;
const BAR_SEC = 5 * 60;
// 04:00 ET on Monday 2026-01-05; each day has 192 five-minute bars, 04:00–20:00 ET.
const DAY0 = Date.parse('2026-01-05T09:00:00Z') / 1000;
const BARS_PER_DAY = 192;

function times(days: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < days; d++) for (let i = 0; i < BARS_PER_DAY; i++) out.push(DAY0 + d * 86_400 + i * BAR_SEC);
  return out;
}

function fakeSeries(ts: number[]) {
  const handlers = new Set<() => void>();
  return {
    current: ts,
    handlers,
    data: vi.fn(function (this: { current: number[] }) {
      return this.current.map((time) => ({ time, open: 1, high: 1, low: 1, close: 1 }));
    }),
    subscribeDataChanged: (h: () => void) => handlers.add(h),
    unsubscribeDataChanged: (h: () => void) => handlers.delete(h),
    change(next: number[]) {
      this.current = next;
      handlers.forEach((h) => h());
    },
  };
}

/** Shows WIDTH / SPACING bars starting at index `view.first`; x is a bar's centre. */
function fakeChart(series: { current: number[] }) {
  const view = { first: 0 };
  const indexOf = (t: number) => series.current.indexOf(t);
  const timeScale = {
    width: () => WIDTH,
    options: () => ({ barSpacing: SPACING }),
    timeToCoordinate: vi.fn((t: number) => {
      const i = indexOf(t);
      return i < 0 ? null : (i - view.first) * SPACING + SPACING / 2;
    }),
    getVisibleRange: () => {
      const ts = series.current;
      const last = Math.min(ts.length - 1, view.first + WIDTH / SPACING - 1);
      return view.first > ts.length - 1 ? null : { from: ts[view.first], to: ts[last] };
    },
  };
  return { view, timeScale, chart: { timeScale: () => timeScale } };
}

function setup(days: number, config: SessionsConfig = US_EQUITY_PRESET) {
  const series = fakeSeries(times(days));
  const { view, timeScale, chart } = fakeChart(series);
  const primitive = new SessionsPrimitive(config);
  primitive.attached({ chart, series, requestUpdate: () => {} } as never);
  const draw = (pixelRatio = 1) => {
    const rects: number[][] = [];
    const seps: number[][] = [];
    let layer: number[][] = rects;
    const ctx = {
      fillStyle: '',
      save: () => {},
      restore: () => {},
      scale: () => {},
      fillRect(x: number, y: number, w: number, h: number) {
        layer.push([x, y, w, h, this.fillStyle as unknown as number]);
      },
    };
    const target = {
      useBitmapCoordinateSpace: (fn: (s: unknown) => void) =>
        fn({
          context: ctx,
          horizontalPixelRatio: pixelRatio,
          verticalPixelRatio: pixelRatio,
          mediaSize: { height: 300 },
          bitmapSize: { height: 300 * pixelRatio },
        }),
    };
    const renderer = primitive.paneViews()[0].renderer();
    layer = rects;
    renderer.drawBackground(target as never);
    layer = seps;
    renderer.draw(target as never);
    return { rects, seps };
  };
  return { series, view, timeScale, primitive, draw };
}

/** The pre-change output: every run and every day boundary, whether on screen or not. */
function fullOutput(ts: number[], first: number, config: SessionsConfig = US_EQUITY_PRESET, pixelRatio = 1) {
  const x = (i: number) => (i - first) * SPACING + SPACING / 2;
  const half = SPACING / 2;
  const ms = ts.map((t) => t * 1000);
  const rects = buildSessionRuns(ms, config)
    .filter((r) => r.sessionIndex >= 0)
    .map((r) => ({ r, color: config.sessions[r.sessionIndex].color }))
    .filter(({ color }) => color && color !== 'transparent')
    .map(({ r, color }) => [x(r.startIdx) - half, 0, x(r.endIdx) + half - (x(r.startIdx) - half), 300, color as unknown as number]);
  const w = Math.max(1, Math.round((config.separatorWidthPx ?? 1) * pixelRatio));
  const seps = config.separatorColor
    ? detectDayBoundaries(ms, config).map((i) => [Math.round((x(i) - half) * pixelRatio), 0, w, 300 * pixelRatio, config.separatorColor as unknown as number])
    : [];
  return { rects, seps };
}

const onPane = (width: number) => (r: number[]) => r[0] + r[2] > 0 && r[0] < width;

function expectSamePixels(actual: { rects: number[][]; seps: number[][] }, full: { rects: number[][]; seps: number[][] }, pixelRatio = 1) {
  expect(actual.rects.filter(onPane(WIDTH))).toEqual(full.rects.filter(onPane(WIDTH)));
  expect(actual.seps.filter(onPane(WIDTH * pixelRatio))).toEqual(full.seps.filter(onPane(WIDTH * pixelRatio)));
  // Nothing drawn that the full output lacked.
  for (const r of actual.rects) expect(full.rects).toContainEqual(r);
  for (const s of actual.seps) expect(full.seps).toContainEqual(s);
}

describe('SessionsPrimitive', () => {
  it('does no data read or coordinate conversion on a data change or view update', () => {
    const t = setup(5);
    t.draw();
    t.series.data.mockClear();
    t.timeScale.timeToCoordinate.mockClear();

    t.series.change(times(5).concat(DAY0 + 5 * 86_400));
    t.primitive.updateAllViews();

    expect(t.series.data).not.toHaveBeenCalled();
    expect(t.timeScale.timeToCoordinate).not.toHaveBeenCalled();
  });

  it('converts only the sessions and separators near the visible range when drawing', () => {
    const t = setup(30);
    t.view.first = 15 * BARS_PER_DAY - 20;
    t.primitive.updateAllViews();
    t.draw();
    // The window spans one day boundary: a few runs and separators, not all 30 days'.
    expect(t.timeScale.timeToCoordinate.mock.calls.length).toBeLessThanOrEqual(14);
  });

  for (const [label, first] of [
    ['the first bars', 0],
    ['across a day boundary', 2 * BARS_PER_DAY - 20],
    ['mid-session', 3 * BARS_PER_DAY + 80],
    ['the last bars', 5 * BARS_PER_DAY - 50],
  ] as const) {
    it(`draws the same shading and separators as the full output for ${label}`, () => {
      const t = setup(5);
      t.view.first = first;
      t.primitive.updateAllViews();
      expectSamePixels(t.draw(), fullOutput(t.series.current, first));
    });
  }

  it('keeps separators identical at a 2x pixel ratio', () => {
    const t = setup(5);
    t.view.first = 2 * BARS_PER_DAY - 20;
    t.primitive.updateAllViews();
    expectSamePixels(t.draw(2), fullOutput(t.series.current, t.view.first, US_EQUITY_PRESET, 2), 2);
  });

  it('recomputes on scroll from the cached data, and re-reads data only after a change', () => {
    const t = setup(5);
    t.draw();
    expect(t.series.data).toHaveBeenCalledTimes(1);

    t.view.first = 3 * BARS_PER_DAY - 10;
    t.primitive.updateAllViews();
    expectSamePixels(t.draw(), fullOutput(t.series.current, t.view.first));
    expect(t.series.data).toHaveBeenCalledTimes(1);

    const longer = times(6);
    t.series.change(longer);
    t.view.first = 5 * BARS_PER_DAY - 10;
    t.primitive.updateAllViews();
    expectSamePixels(t.draw(), fullOutput(longer, t.view.first));
    expect(t.series.data).toHaveBeenCalledTimes(2);
  });

  it('a config change redraws without separators when they are turned off', () => {
    const t = setup(5);
    t.view.first = 2 * BARS_PER_DAY - 20;
    t.primitive.updateAllViews();
    expect(t.draw().seps.length).toBeGreaterThan(0);
    const noSeparators = { ...US_EQUITY_PRESET, separatorColor: undefined };
    t.primitive.applyOptions(noSeparators);
    expectSamePixels(t.draw(), fullOutput(t.series.current, t.view.first, noSeparators));
  });

  it('draws nothing when no bars are visible, and unsubscribes when detached', () => {
    const t = setup(2);
    t.view.first = 10_000;
    t.primitive.updateAllViews();
    expect(t.draw()).toEqual({ rects: [], seps: [] });
    t.primitive.detached();
    expect(t.series.handlers.size).toBe(0);
  });

  it('a data change alone is enough for the next draw to show the new data', () => {
    const t = setup(5);
    t.view.first = 5 * BARS_PER_DAY - 10;
    t.primitive.updateAllViews();
    t.draw();
    const longer = times(6);
    t.series.change(longer);
    expectSamePixels(t.draw(), fullOutput(longer, t.view.first));
    expect(t.series.data).toHaveBeenCalledTimes(2);
  });
});
