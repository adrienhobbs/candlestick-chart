import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { supertrend } from 'fast-technical-indicators';

export const SuperTrendIndicator: IndicatorDefinition = {
  metadata: {
    id: 'supertrend',
    name: 'SuperTrend',
    description: 'Modern trend-following indicator with clear buy/sell signals',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 10,
      description: 'Period for ATR calculation',
      min: 1,
      max: 100,
      step: 1,
    }),
    multiplier: numberSetting({
      label: 'Multiplier',
      defaultValue: 3,
      description: 'ATR multiplier for bands',
      min: 0.1,
      max: 10,
      step: 0.1,
    }),
    color: colorSetting('Line Color', '#06b6d4', 'Color of the SuperTrend line'),
    lineWidth: lineWidthSetting(2, 'Width of the SuperTrend line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    const supertrendValues = supertrend({
      high,
      low,
      close,
      period: settings.period,
      multiplier: settings.multiplier,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: supertrendValues[i]?.supertrend ?? NaN,
    }));
  },
};
