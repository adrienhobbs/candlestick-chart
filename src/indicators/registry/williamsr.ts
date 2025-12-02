import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { williamsr } from 'fast-technical-indicators';

export const WilliamsRIndicator: IndicatorDefinition = {
  metadata: {
    id: 'williamsr',
    name: 'Williams %R',
    description: 'Williams Percent Range - momentum indicator showing overbought/oversold levels',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for Williams %R calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#a855f7',
      description: 'Color of the Williams %R line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the Williams %R line',
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

    const williamsValues = williamsr({
      high,
      low,
      close,
      period: settings.period,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: williamsValues[i] ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
