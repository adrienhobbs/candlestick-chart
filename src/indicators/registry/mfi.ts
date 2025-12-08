import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { mfi } from 'fast-technical-indicators';

export const MFIIndicator: IndicatorDefinition = {
  metadata: {
    id: 'mfi',
    name: 'MFI',
    description: 'Money Flow Index - volume-weighted momentum indicator (RSI with volume)',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for MFI calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#f59e0b',
      description: 'Color of the MFI line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the MFI line',
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
    const volume = bars.map(bar => bar.volume || 0);

    const mfiValues = mfi({
      high,
      low,
      close,
      volume,
      period: settings.period,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: mfiValues[i] ?? NaN,
    }));
  },
};
