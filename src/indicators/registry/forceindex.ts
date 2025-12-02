import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { forceindex } from 'fast-technical-indicators';

export const ForceIndexIndicator: IndicatorDefinition = {
  metadata: {
    id: 'forceindex',
    name: 'Force Index',
    description: 'Measures buying/selling pressure using price and volume',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 13,
      description: 'Smoothing period for force index',
      min: 1,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#8b5cf6',
      description: 'Color of the Force Index line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the Force Index line',
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
    const close = bars.map(bar => bar.close);
    const volume = bars.map(bar => bar.volume || 0);

    const forceValues = forceindex({
      close,
      volume,
      period: settings.period,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: forceValues[i] ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
