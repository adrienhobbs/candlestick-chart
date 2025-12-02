import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for RSI calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#8b5cf6',
      description: 'Color of the RSI line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the RSI line',
      min: 1,
      max: 5,
      step: 1,
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const rsiValues = calculateRSI(bars, settings.period);
    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: rsiValues[i],
      }))
      .filter((point) => !isNaN(point.value));
  },
};
