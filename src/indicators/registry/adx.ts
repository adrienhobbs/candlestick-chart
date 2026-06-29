import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { adx } from 'fast-technical-indicators';

export const ADXIndicator: IndicatorDefinition = {
  metadata: {
    id: 'adx',
    name: 'ADX',
    description: 'Average Directional Index - measures trend strength (not direction)',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for ADX calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    color: colorSetting('Line Color', '#06b6d4', 'Color of the ADX line'),
    lineWidth: lineWidthSetting(2, 'Width of the ADX line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    const adxValues = adx({
      high,
      low,
      close,
      period: settings.period,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: adxValues[i]?.adx ?? NaN,
    }));
  },
};
