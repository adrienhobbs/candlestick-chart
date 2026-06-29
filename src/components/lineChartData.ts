import type { LineData, Time } from 'lightweight-charts';

/** A single ordinal point fed to {@link LineChart}: `x` is an ordinal index
 *  (e.g. trade #), not a timestamp; `y` is the value at that ordinal. */
export interface OrdinalPoint {
  x: number;
  y: number;
}

/**
 * Convert ordinal `{x,y}` points → lightweight-charts `LineData`: `x` becomes an
 * integer `time`, sorted ascending, deduped by `x` (last wins), and NaN/Infinity
 * filtered — all three are LWC requirements.
 */
export function toLineData(points: OrdinalPoint[]): LineData[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const out: LineData[] = [];
  let lastX = Number.NaN;
  for (const p of sorted) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const point = { time: p.x as Time, value: p.y };
    if (p.x === lastX) out[out.length - 1] = point;
    else {
      out.push(point);
      lastX = p.x;
    }
  }
  return out;
}
