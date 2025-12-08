import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for ATR calculation',
      min: 1,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#14b8a6',
      description: 'Color of the ATR line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the ATR line',
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
