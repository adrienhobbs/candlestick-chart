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
 * LAGGING: a pivot at bar i is only known once bar i + strength has closed. With
 * `plotAt: 'pivot'` (default) the point is drawn AT bar i: on a live chart the
 * newest `strength` bars never carry a point, and a point appears `strength` bars
 * after the bar it marks, so don't read it as something visible at its own bar.
 * `plotAt: 'confirmation'` draws it on bar i + strength instead (still at bar i's
 * price): every point is then something you could have seen at its bar, which is
 * what a chart cut at a decision bar must show.
 */
export type SwingPlotAt = 'pivot' | 'confirmation';

export function swingPoints(bars: OHLCVBar[], strength: number, plotAt: SwingPlotAt = 'pivot'): IndicatorOutput[] {
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
    const at = plotAt === 'confirmation' ? i + k : i;
    if (isHigh) out[at].high = bars[i].high;
    if (isLow) out[at].low = bars[i].low;
  }
  return out;
}

export const SwingPointsIndicator: IndicatorDefinition = {
  metadata: {
    id: 'swingpoints',
    name: 'Swing Points',
    description:
      'Dots at swing highs and lows (pivot beyond `strength` bars each side). Lagging: each point is confirmed `strength` bars after the bar it marks; plot it there with Plot At → Confirmation bar.',
    category: IndicatorCategory.TREND,
    version: '1.1.0',
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
    plotAt: {
      type: 'select',
      label: 'Plot At',
      defaultValue: 'pivot',
      description: 'Pivot bar (hindsight), or the bar the pivot became known (no look-ahead)',
      options: [
        { label: 'Pivot bar', value: 'pivot' },
        { label: 'Confirmation bar', value: 'confirmation' },
      ],
    },
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
  calculate: (bars, settings) =>
    swingPoints(
      bars,
      Number(settings.strength ?? 3),
      settings.plotAt === 'confirmation' ? 'confirmation' : 'pivot',
    ),
};
