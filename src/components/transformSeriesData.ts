import type { Time } from 'lightweight-charts';
import type { IndicatorOutput } from '../indicators/core/types';

/**
 * Map calculated indicator points to lightweight-charts `{ time, value }` points
 * for a given output `field`, dropping warm-up / undefined points (e.g. an EMA's
 * first `period` bars) that lightweight-charts would reject.
 *
 * The default validity predicate is `Number.isFinite`; pass `(v) => !isNaN(v)`
 * for the band-fill branches that historically used an `isNaN` check (so values
 * are filtered exactly as before — the two predicates differ for `Infinity`).
 */
export function transformSeriesData(
  data: IndicatorOutput[],
  field: string,
  isValid: (value: number) => boolean = Number.isFinite,
): Array<{ time: Time; value: number }> {
  return data
    .map((d) => ({ time: d.time as Time, value: d[field] }))
    .filter((d) => isValid(d.value));
}
