import { ChartLine } from '../types/chart';

/**
 * Find the candidate price line whose on-screen y-coordinate is closest to
 * `mouseY`, within `hitPx`. Returns its `id`, or `null` when nothing is in
 * range. Pure (no lightweight-charts import) so it can be unit-tested; the
 * caller injects `priceToCoordinate` (the series projection) and pre-filters
 * `candidates` (e.g. by `draggable`/`editable`).
 *
 * Candidates whose price can't be projected (`priceToCoordinate` → `null`, e.g.
 * scrolled off-scale) are skipped.
 */
export function nearestLineWithin(
  mouseY: number,
  candidates: ChartLine[],
  priceToCoordinate: (price: number) => number | null,
  hitPx: number,
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const line of candidates) {
    const y = priceToCoordinate(line.price);
    if (y === null) continue;
    const dist = Math.abs(y - mouseY);
    if (dist <= hitPx && dist < bestDist) {
      bestDist = dist;
      bestId = line.id;
    }
  }
  return bestId;
}
