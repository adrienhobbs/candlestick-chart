import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
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
    period: numberSetting({
      label: 'Period',
      defaultValue: 14,
      description: 'Number of bars for Williams %R calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    color: colorSetting('Line Color', '#a855f7', 'Color of the Williams %R line'),
    lineWidth: lineWidthSetting(2, 'Width of the Williams %R line'),
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

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: williamsValues[i] ?? NaN,
    }));
  },
};
