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

/**
 * Like {@link transformSeriesData} but maps non-finite values to **whitespace**
 * points (`{ time }`, no value) instead of dropping them — so a line series BREAKS
 * at those times (lightweight-charts connects across dropped points but not across
 * whitespace). Used by single-output line indicators that want gaps (e.g. a daily
 * level that resets each trading day). Warm-up still renders identically (leading
 * whitespace draws nothing).
 */
export function transformSeriesDataWithGaps(
  data: IndicatorOutput[],
  field: string,
): Array<{ time: Time; value: number } | { time: Time }> {
  return data.map((d) =>
    Number.isFinite(d[field])
      ? { time: d.time as Time, value: d[field] }
      : { time: d.time as Time },
  );
}
