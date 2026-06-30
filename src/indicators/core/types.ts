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
}

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
});

export type SettingFieldType = z.infer<typeof SettingFieldTypeSchema>;
export type LineStyle = z.infer<typeof LineStyleSchema>;
export type SettingField = z.infer<typeof SettingFieldSchema>;
export type IndicatorSettings = z.infer<typeof IndicatorSettingsSchema>;
export type IndicatorMetadata = z.infer<typeof IndicatorMetadataSchema>;
export type RenderConfig = z.infer<typeof RenderConfigSchema>;

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
