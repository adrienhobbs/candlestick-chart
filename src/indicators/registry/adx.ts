import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for ADX calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#06b6d4',
      description: 'Color of the ADX line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the ADX line',
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

    const adxValues = adx({
      high,
      low,
      close,
      period: settings.period,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: adxValues[i]?.adx ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
