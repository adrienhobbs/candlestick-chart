import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { stochasticrsi } from 'fast-technical-indicators';

export const StochRSIIndicator: IndicatorDefinition = {
  metadata: {
    id: 'stochrsi',
    name: 'Stochastic RSI',
    description: 'Stochastic RSI - applies Stochastic oscillator to RSI values',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    rsiPeriod: numberSetting({
      label: 'RSI Period',
      defaultValue: 14,
      description: 'Period for RSI calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    stochPeriod: numberSetting({
      label: 'Stochastic Period',
      defaultValue: 14,
      description: 'Period for Stochastic calculation',
      min: 2,
      max: 100,
      step: 1,
    }),
    kPeriod: numberSetting({
      label: '%K Period',
      defaultValue: 3,
      description: 'Smoothing period for %K',
      min: 1,
      max: 50,
      step: 1,
    }),
    dPeriod: numberSetting({
      label: '%D Period',
      defaultValue: 3,
      description: 'Smoothing period for %D signal line',
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
    const values = bars.map(bar => bar.close);

    const stochRSIValues = stochasticrsi({
      values,
      rsiPeriod: settings.rsiPeriod,
      stochasticPeriod: settings.stochPeriod,
      kPeriod: settings.kPeriod,
      dPeriod: settings.dPeriod,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: stochRSIValues[i]?.k ?? NaN,
      signal: stochRSIValues[i]?.d ?? NaN,
    }));
  },
};
