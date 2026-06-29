import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { calculateEMA } from '../utils/calculations';

export const EMAIndicator: IndicatorDefinition = {
  metadata: {
    id: 'ema',
    name: 'EMA',
    description: 'Exponential Moving Average - gives more weight to recent prices',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 12,
      description: 'Number of bars for EMA calculation',
      min: 1,
      max: 500,
      step: 1,
    }),
    color: colorSetting('Line Color', '#10b981', 'Color of the EMA line'),
    lineWidth: lineWidthSetting(2, 'Width of the EMA line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
  },
  calculate: (bars, settings) => {
    const emaValues = calculateEMA(bars, settings.period);
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: emaValues[i],
    }));
  },
};
