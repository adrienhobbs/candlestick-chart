import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { roc } from 'fast-technical-indicators';

export const ROCIndicator: IndicatorDefinition = {
  metadata: {
    id: 'roc',
    name: 'ROC',
    description: 'Rate of Change - measures percentage change in price over a period',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period',
      defaultValue: 12,
      description: 'Number of bars for ROC calculation',
      min: 1,
      max: 100,
      step: 1,
    }),
    color: colorSetting('Line Color', '#06b6d4', 'Color of the ROC line'),
    lineWidth: lineWidthSetting(2, 'Width of the ROC line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const values = bars.map(bar => bar.close);

    const rocValues = roc({
      values,
      period: settings.period,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: rocValues[i] ?? NaN,
    }));
  },
};
