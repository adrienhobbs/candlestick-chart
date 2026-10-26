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

/** A box in the pane's top-left corner that pills must not cover (the OHLC legend). */
export interface KeepOut {
  /** Right edge, media px from the pane's left. */
  right: number;
  /** Bottom edge, media px from the pane's top. */
  bottom: number;
}

export interface PillMetrics {
  /** Top of the first row, media px. */
  top: number;
  height: number;
  rowGap: number;
  /** Pills are clamped this far inside the pane's left edge when drawn. */
  inset: number;
}

/**
 * Top (media px) of each signpost pill. Pills that would sit under `keepOut` get
 * their own rows, starting just below it; the rest start at the pane's top edge.
 */
export function layoutPillTops(pills: PillBox[], keepOut: KeepOut | null, m: PillMetrics): number[] {
  const blocked = (p: PillBox) =>
    keepOut != null && Math.max(p.x - p.width / 2, m.inset) < keepOut.right;
  const tops = new Array<number>(pills.length).fill(m.top);
  for (const underLegend of [false, true]) {
    const idxs = pills.map((_, i) => i).filter((i) => blocked(pills[i]) === underLegend);
    if (idxs.length === 0) continue;
    const base = underLegend && keepOut ? Math.max(m.top, keepOut.bottom + m.rowGap) : m.top;
    const rows = layoutPillRows(idxs.map((i) => pills[i]));
    idxs.forEach((i, k) => {
      tops[i] = base + rows[k] * (m.height + m.rowGap);
    });
  }
  return tops;
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
