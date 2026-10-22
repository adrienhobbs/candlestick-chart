import { z } from 'zod';
import { OHLCVBar } from '../../types/chart';

export enum IndicatorCategory {
  TREND = 'Trend',
  MOMENTUM = 'Momentum',
  VOLATILITY = 'Volatility',
  VOLUME = 'Volume',
  OSCILLATORS = 'Oscillators',
}

export enum ChartSeriesType {
  LINE = 'line',
  HISTOGRAM = 'histogram',
  AREA = 'area',
  /**
   * Point markers on the price pane (one per bar with a finite value), drawn as
   * candlestick series markers rather than a series of their own.
   */
  POINTS = 'points',
}

export const PointShapeSchema = z.enum(['circle', 'square', 'arrowUp', 'arrowDown']);
export const PointPositionSchema = z.enum(['aboveBar', 'belowBar', 'atPrice']);

export const SettingFieldTypeSchema = z.enum([
  'number',
  'color',
  'boolean',
  'select',
  'lineStyle',
]);

export const LineStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export const SettingFieldSchema = z.object({
  type: SettingFieldTypeSchema,
  label: z.string(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});

export const IndicatorSettingsSchema = z.record(z.string(), SettingFieldSchema);

export const IndicatorMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.nativeEnum(IndicatorCategory),
  version: z.string().default('1.0.0'),
});

export const RenderConfigSchema = z.object({
  seriesType: z.nativeEnum(ChartSeriesType),
  outputCount: z.number().default(1),
  overlay: z.boolean().default(true),
  hasBandFill: z.boolean().optional(),
  fillBands: z.object({
    upper: z.string(),
    lower: z.string(),
  }).optional(),
  /**
   * Show the series' last-value price line (the dotted horizontal line that spans
   * the full chart width at the most recent value). Defaults to true. Set false for
   * series whose value resets/segments over time (e.g. a per-day level) so the chart
   * isn't dominated by one flat line at the latest value.
   */
  priceLineVisible: z.boolean().optional(),
  /** Show the last-value axis label (the colored chip on the price scale). Defaults to true. */
  lastValueVisible: z.boolean().optional(),
  /**
   * POINTS only. The marker shape; defaults to 'circle'. An instance setting of
   * the same name (e.g. a `select` setting) overrides it.
   */
  pointShape: PointShapeSchema.optional(),
  /**
   * POINTS only. 'atPrice' (default) centres the marker on the output value;
   * 'aboveBar' / 'belowBar' place it off the candle and ignore the value's price.
   * An instance setting of the same name overrides it.
   */
  pointPosition: PointPositionSchema.optional(),
  /** POINTS only. Marker size in lightweight-charts marker units; defaults to 1. */
  pointSize: z.number().positive().optional(),
  /**
   * POINTS only. The output fields drawn as points, each in its own colour
   * (`<field>Color` setting, else `color` for `value`, else a palette slot).
   * Defaults to `['value']` when `outputCount` is 1, else every field but `time`.
   */
  pointFields: z.array(z.string()).optional(),
});

export type SettingFieldType = z.infer<typeof SettingFieldTypeSchema>;
export type LineStyle = z.infer<typeof LineStyleSchema>;
export type SettingField = z.infer<typeof SettingFieldSchema>;
export type IndicatorSettings = z.infer<typeof IndicatorSettingsSchema>;
export type IndicatorMetadata = z.infer<typeof IndicatorMetadataSchema>;
export type RenderConfig = z.infer<typeof RenderConfigSchema>;
export type PointShape = z.infer<typeof PointShapeSchema>;
export type PointPosition = z.infer<typeof PointPositionSchema>;

export interface IndicatorOutput {
  time: number;
  value: number;
  [key: string]: number;
}

export type IndicatorCalculation = (
  bars: OHLCVBar[],
  settings: Record<string, any>
) => IndicatorOutput[];

export interface IndicatorDefinition {
  metadata: IndicatorMetadata;
  settings: IndicatorSettings;
  renderConfig: RenderConfig;
  calculate: IndicatorCalculation;
}

export interface IndicatorInstance {
  id: string;
  definitionId: string;
  name: string;
  settings: Record<string, any>;
  data?: IndicatorOutput[];
}

export const IndicatorInstanceSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  name: z.string(),
  settings: z.record(z.string(), z.any()),
});
