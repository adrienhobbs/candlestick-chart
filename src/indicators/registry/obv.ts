import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { obv } from 'fast-technical-indicators';

export const OBVIndicator: IndicatorDefinition = {
  metadata: {
    id: 'obv',
    name: 'OBV',
    description: 'On-Balance Volume - cumulative volume indicator showing buying/selling pressure',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#10b981',
      description: 'Color of the OBV line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the OBV line',
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
  calculate: (bars) => {
    const close = bars.map(bar => bar.close);
    const volume = bars.map(bar => bar.volume || 0);

    const obvValues = obv({ close, volume });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: obvValues[i] ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
