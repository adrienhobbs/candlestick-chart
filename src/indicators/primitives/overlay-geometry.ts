// Pure geometry for time-bounded overlays (segments + boxes). Kept free of
// lightweight-charts imports so it's unit-testable; the caller injects
// `timeToCoordinate` (the time-scale projection) and the visible range.

/**
 * Clamp a `[startSec, endSec]` time span to on-screen x-coordinates.
 *
 * - Returns `null` when the span is entirely outside the visible range (the
 *   caller skips drawing → auto-hide when scrolled away).
 * - When an endpoint is off-screen (`timeToCoordinate` → null), it's clamped to
 *   the plot edge (`0` left, `width` right) based on which side it falls on — so a
 *   partially-visible span still draws across the visible portion, and a span that
 *   straddles the whole view draws full-width.
 *
 * Endpoints are expected to be bar-aligned times (real bar timestamps); on-screen
 * non-bar times have no coordinate and would clamp to an edge.
 */
export function clampOverlayX(
  startSec: number,
  endSec: number,
  vFrom: number,
  vTo: number,
  width: number,
  timeToCoordinate: (timeSec: number) => number | null,
): [number, number] | null {
  if (endSec < vFrom || startSec > vTo) return null;
  let x1 = timeToCoordinate(startSec);
  let x2 = timeToCoordinate(endSec);
  if (x1 === null) x1 = startSec <= vFrom ? 0 : width;
  if (x2 === null) x2 = endSec >= vTo ? width : 0;
  return [x1, x2];
}
