import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 12,
      description: 'Number of bars for EMA calculation',
      min: 1,
      max: 500,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#10b981',
      description: 'Color of the EMA line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the EMA line',
      min: 1,
      max: 5,
      step: 1,
    },
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
