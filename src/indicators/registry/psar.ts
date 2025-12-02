import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { psar } from 'fast-technical-indicators';

export const PSARIndicator: IndicatorDefinition = {
  metadata: {
    id: 'psar',
    name: 'Parabolic SAR',
    description: 'Parabolic Stop and Reverse - shows potential reversal points as dots',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    step: {
      type: 'number',
      label: 'Step (AF)',
      defaultValue: 0.02,
      description: 'Acceleration Factor step',
      min: 0.001,
      max: 1,
      step: 0.001,
    },
    max: {
      type: 'number',
      label: 'Max AF',
      defaultValue: 0.2,
      description: 'Maximum Acceleration Factor',
      min: 0.01,
      max: 1,
      step: 0.01,
    },
    color: {
      type: 'color',
      label: 'Color',
      defaultValue: '#f59e0b',
      description: 'Color of the SAR dots',
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);

    const psarValues = psar({
      high,
      low,
      step: settings.step,
      max: settings.max,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: psarValues[i] ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
