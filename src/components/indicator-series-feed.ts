import type { BarsSyncPlan } from './bars-sync-plan';

/** An indicator series point: lightweight-charts line / histogram data or whitespace. */
type SeriesPoint = { time: unknown };

/** The two series methods indicator syncing uses (an `ISeriesApi` satisfies it). */
export interface PointSink<T> {
  setData(data: T[]): void;
  update(point: T): void;
}

/** More changed tail points than this go through setData. */
const MAX_TAIL_POINTS = 3;

function samePoint(a: SeriesPoint, b: SeriesPoint): boolean {
  if (a === b) return true;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const k in x) if (x[k] !== y[k]) return false;
  for (const k in y) if (!(k in x)) return false;
  return true;
}

/**
 * Index of the first point of `next` that `update()` must send, given the series
 * holds `prev`; `next.length` when nothing changed; null when only setData can
 * express the change: an earlier point moved, the series shrank, the last point's
 * time changed, or more than a few tail points are new.
 */
export function tailStart(prev: readonly SeriesPoint[], next: readonly SeriesPoint[]): number | null {
  if (prev.length === 0 || next.length < prev.length) return null;
  const last = prev.length - 1;
  for (let i = 0; i < last; i += 1) if (!samePoint(prev[i], next[i])) return null;
  let start: number;
  if (samePoint(prev[last], next[last])) start = prev.length;
  else if (prev[last].time === next[last].time) start = last;
  else return null;
  if (next.length - start > MAX_TAIL_POINTS) return null;
  for (let i = Math.max(start, 1); i < next.length; i += 1) {
    if (!((next[i].time as number) > (next[i - 1].time as number))) return null;
  }
  return start;
}

/**
 * Feeds indicator series, remembering the points each one holds. When the bars
 * changed only at the tail (`update` / `append` / `none`), a series whose new
 * points differ only at the end gets those points through `update()`; anything
 * else, and any series it has not fed before, gets `setData`. A series it fed with
 * the same points is left alone.
 */
export function createSeriesFeeder() {
  const held = new WeakMap<object, readonly SeriesPoint[]>();
  return {
    set<T extends SeriesPoint>(series: PointSink<T>, data: T[]): void {
      series.setData(data);
      held.set(series, data);
    },
    sync<T extends SeriesPoint>(series: PointSink<T>, data: T[], plan: BarsSyncPlan | null): void {
      const prev = held.get(series);
      const start = prev === undefined ? null : tailStart(prev, data);
      if (start === data.length) {
        held.set(series, data);
        return;
      }
      if (start === null || (plan !== 'update' && plan !== 'append' && plan !== 'none')) {
        series.setData(data);
      } else {
        // lightweight-charts writes a field onto the point update() gets, so it gets a
        // copy; the held point must stay comparable with the next recompute's.
        for (let i = start; i < data.length; i += 1) series.update({ ...data[i] });
      }
      held.set(series, data);
    },
  };
}

export type SeriesFeeder = ReturnType<typeof createSeriesFeeder>;
