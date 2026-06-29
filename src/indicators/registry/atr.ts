import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { atr } from 'fast-technical-indicators';

export const ATRIndicator: IndicatorDefinition = {
  metadata: {
    id: 'atr',
    name: 'ATR',
    description: 'Average True Range - measures market volatility',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for ATR calculation',
      min: 1,
      max: 100,
      step: 1,
    }),
    color: colorSetting('Line Color', '#14b8a6', 'Color of the ATR line'),
    lineWidth: lineWidthSetting(2, 'Width of the ATR line'),
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

    const atrValues = atr({
      high,
      low,
      close,
      period: settings.period,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: atrValues[i] ?? NaN,
    }));
  },
};
