import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { wma } from 'fast-technical-indicators';

export const WMAIndicator: IndicatorDefinition = {
  metadata: {
    id: 'wma',
    name: 'WMA',
    description: 'Weighted Moving Average - gives more weight to recent prices',
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
      defaultValue: '#f59e0b',
      description: 'Color of the WMA line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the WMA line',
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
    const values = bars.map(bar => bar.close);

    const wmaValues = wma({
      values,
      period: settings.period,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: wmaValues[i] ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
