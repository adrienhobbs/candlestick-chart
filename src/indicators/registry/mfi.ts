import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
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
    period: numberSetting({
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for MFI calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    color: colorSetting('Line Color', '#f59e0b', 'Color of the MFI line'),
    lineWidth: lineWidthSetting(2, 'Width of the MFI line'),
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
