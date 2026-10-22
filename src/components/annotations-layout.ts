/**
 * Pure layout for the annotations primitive (signpost pills, rail marks), kept out of
 * the canvas code so it can be tested.
 */

export interface PillBox {
  /** Pill's horizontal centre in media px. */
  x: number;
  width: number;
}

/**
 * Greedy rows for signpost pills, left to right: each pill takes the first row whose
 * last pill ends at least `gap` px before it starts. Returns a row index per input
 * (in input order). Rows beyond `maxRows - 1` reuse the last row (overlap rather than
 * march down over the candles).
 */
export function layoutPillRows(pills: PillBox[], gap = 4, maxRows = 3): number[] {
  const order = pills.map((_, i) => i).sort((a, b) => pills[a].x - pills[b].x);
  const rowEnds: number[] = [];
  const rows = new Array<number>(pills.length).fill(0);
  for (const i of order) {
    const left = pills[i].x - pills[i].width / 2;
    let row = rowEnds.findIndex((end) => left >= end + gap);
    if (row === -1) row = rowEnds.length < maxRows ? rowEnds.length : maxRows - 1;
    rowEnds[row] = Math.max(rowEnds[row] ?? -Infinity, pills[i].x + pills[i].width / 2);
    rows[i] = row;
  }
  return rows;
}

/**
 * Horizontal offsets for marks that share a bar, centred on it: n marks `step` px apart.
 * Keyed by the bar time each mark snapped to; returns an offset per input.
 */
export function spreadSameBar(barTimes: number[], step: number): number[] {
  const groups = new Map<number, number[]>();
  barTimes.forEach((t, i) => {
    const g = groups.get(t);
    if (g) g.push(i);
    else groups.set(t, [i]);
  });
  const out = new Array<number>(barTimes.length).fill(0);
  for (const idxs of groups.values()) {
    const n = idxs.length;
    idxs.forEach((idx, k) => {
      out[idx] = (k - (n - 1) / 2) * step;
    });
  }
  return out;
}
