import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars to average',
      min: 1,
      max: 500,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the SMA line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the SMA line',
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
    const smaValues = calculateSMA(bars, settings.period);
    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: smaValues[i],
    }));
  },
};
