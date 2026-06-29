import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { stochastic } from 'fast-technical-indicators';

export const StochasticIndicator: IndicatorDefinition = {
  metadata: {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    description: 'Compares closing price to price range over time - momentum indicator',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    period: numberSetting({
      label: 'Period (K)',
      defaultValue: 14,
      description: 'Number of bars for %K calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    signalPeriod: numberSetting({
      label: 'Signal Period (D)',
      defaultValue: 3,
      description: 'Number of bars for %D signal line',
      min: 1,
      max: 50,
      step: 1,
    }),
    kColor: colorSetting('%K Line Color', '#3b82f6', 'Color of the %K line'),
    dColor: colorSetting('%D Line Color', '#ef4444', 'Color of the %D signal line'),
    lineWidth: lineWidthSetting(2, 'Width of the indicator lines'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 2,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    const stochValues = stochastic({
      high,
      low,
      close,
      period: settings.period,
      signalPeriod: settings.signalPeriod,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: stochValues[i]?.k ?? NaN,
      signal: stochValues[i]?.d ?? NaN,
    }));
  },
};
