import type { SeriesMarker, Time } from 'lightweight-charts';
import {
  PointPositionSchema,
  PointShapeSchema,
  type IndicatorOutput,
  type PointPosition,
  type PointShape,
  type RenderConfig,
} from '../indicators/core/types';
import { PALETTE } from '../constants/colors';

/**
 * Pure mapping for POINTS indicators: calculated outputs → candlestick series
 * markers. A finite output value is a point at that bar and price; anything
 * else (NaN, ±Infinity, missing) is no point.
 */

export interface PointStyle {
  shape: PointShape;
  position: PointPosition;
  size: number;
}

/**
 * Colour for a named output field: an explicit `<field>Color` setting, then the
 * generic `color` for the primary `value` field, then a stable palette slot.
 * Shared with the multi-output LINE renderer.
 */
export function fieldColor(settings: Record<string, unknown>, key: string, idx: number): string {
  const color = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  return (
    color(settings[`${key}Color`]) ??
    (key === 'value' ? color(settings.color) : undefined) ??
    PALETTE[idx % PALETTE.length]
  );
}

/** renderConfig defaults, overridden by same-named instance settings when valid. */
export function resolvePointStyle(renderConfig: RenderConfig, settings: Record<string, unknown>): PointStyle {
  const shape = PointShapeSchema.safeParse(settings.pointShape);
  const position = PointPositionSchema.safeParse(settings.pointPosition);
  const size = Number(settings.pointSize);
  return {
    shape: shape.success ? shape.data : (renderConfig.pointShape ?? 'circle'),
    position: position.success ? position.data : (renderConfig.pointPosition ?? 'atPrice'),
    size: Number.isFinite(size) && size > 0 ? size : (renderConfig.pointSize ?? 1),
  };
}

/** The output fields a POINTS indicator draws, one marker set each. */
export function pointFieldsOf(renderConfig: RenderConfig, data: IndicatorOutput[]): string[] {
  if (renderConfig.pointFields && renderConfig.pointFields.length > 0) return renderConfig.pointFields;
  if (renderConfig.outputCount === 1 || data.length === 0) return ['value'];
  return Object.keys(data[0]).filter((k) => k !== 'time');
}

export function buildIndicatorPointMarkers(
  data: IndicatorOutput[],
  field: string,
  style: PointStyle,
  color: string,
): SeriesMarker<Time>[] {
  const out: SeriesMarker<Time>[] = [];
  for (const point of data) {
    const price = point[field];
    if (typeof price !== 'number' || !Number.isFinite(price) || !Number.isFinite(point.time)) continue;
    const common = { time: point.time as Time, shape: style.shape, color, size: style.size };
    out.push(
      style.position === 'atPrice'
        ? { ...common, position: 'atPriceMiddle', price }
        : { ...common, position: style.position },
    );
  }
  // lightweight-charts requires markers in ascending time order.
  return out.sort((a, b) => (a.time as number) - (b.time as number));
}
