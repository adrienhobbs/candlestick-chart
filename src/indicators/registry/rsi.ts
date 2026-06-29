import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { calculateRSI } from '../utils/calculations';

export const RSIIndicator: IndicatorDefinition = {
  metadata: {
    id: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index - momentum oscillator measuring speed and magnitude of price changes',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for RSI calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    color: colorSetting('Line Color', '#8b5cf6', 'Color of the RSI line'),
    lineWidth: lineWidthSetting(2, 'Width of the RSI line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const rsiValues = calculateRSI(bars, settings.period);
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: rsiValues[i],
    }));
  },
};
