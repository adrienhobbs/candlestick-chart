import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
  type IndicatorOutput,
} from '../core/types';
import { colorSetting, numberSetting } from '../core/settings';
import type { OHLCVBar } from '../../types/chart';

/**
 * Swing (pivot) highs and lows. Bar i is a swing high when its high is strictly
 * above the highs of the `strength` bars on each side (a swing low mirrors it on
 * lows); equal neighbours are not a pivot.
 *
 * LAGGING: a pivot at bar i is only known once bar i + strength has closed, but
 * the point is drawn AT bar i. On a live chart the newest `strength` bars never
 * carry a point, and a point appears `strength` bars after the bar it marks.
 * Don't read a point as something that was visible at its own bar.
 */
export function swingPoints(bars: OHLCVBar[], strength: number): IndicatorOutput[] {
  const k = Math.max(1, Math.floor(strength));
  const out: IndicatorOutput[] = bars.map((bar) => ({
    time: bar.timestamp / 1000,
    // Unused: the points are the `high` / `low` fields (renderConfig.pointFields).
    value: NaN,
    high: NaN,
    low: NaN,
  }));
  for (let i = k; i < bars.length - k; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - k; j <= i + k && (isHigh || isLow); j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
    }
    if (isHigh) out[i].high = bars[i].high;
    if (isLow) out[i].low = bars[i].low;
  }
  return out;
}

export const SwingPointsIndicator: IndicatorDefinition = {
  metadata: {
    id: 'swingpoints',
    name: 'Swing Points',
    description:
      'Dots at swing highs and lows (pivot beyond `strength` bars each side). Lagging: each point is confirmed `strength` bars after the bar it marks.',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    strength: numberSetting({
      label: 'Strength (bars each side)',
      defaultValue: 3,
      description: 'Bars on each side the pivot must exceed; also how many bars late it is confirmed',
      min: 1,
      max: 20,
      step: 1,
    }),
    highColor: colorSetting('High Color', '#f472b6', 'Color of the swing-high points'),
    lowColor: colorSetting('Low Color', '#38bdf8', 'Color of the swing-low points'),
    pointSize: numberSetting({
      label: 'Point Size',
      defaultValue: 1,
      description: 'Marker size (lightweight-charts marker units)',
      min: 0.5,
      max: 4,
      step: 0.5,
    }),
  },
  renderConfig: {
    seriesType: ChartSeriesType.POINTS,
    outputCount: 2,
    overlay: true,
    pointShape: 'circle',
    pointPosition: 'atPrice',
    pointFields: ['high', 'low'],
  },
  calculate: (bars, settings) => swingPoints(bars, Number(settings.strength ?? 3)),
};
