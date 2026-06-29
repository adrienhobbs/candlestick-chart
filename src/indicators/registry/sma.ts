import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { calculateSMA } from '../utils/calculations';

export const SMAIndicator: IndicatorDefinition = {
  metadata: {
    id: 'sma',
    name: 'SMA',
    description: 'Simple Moving Average - smooths price data by averaging over a period',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars to average',
      min: 1,
      max: 500,
      step: 1,
    }),
    color: colorSetting('Line Color', '#3b82f6', 'Color of the SMA line'),
    lineWidth: lineWidthSetting(2, 'Width of the SMA line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
  },
  calculate: (bars, settings) => {
    const smaValues = calculateSMA(bars, settings.period);
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: smaValues[i],
    }));
  },
};
