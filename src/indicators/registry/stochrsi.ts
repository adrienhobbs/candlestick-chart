import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    rsiPeriod: {
      type: 'number',
      label: 'RSI Period',
      defaultValue: 14,
      description: 'Period for RSI calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    stochPeriod: {
      type: 'number',
      label: 'Stochastic Period',
      defaultValue: 14,
      description: 'Period for Stochastic calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    kPeriod: {
      type: 'number',
      label: '%K Period',
      defaultValue: 3,
      description: 'Smoothing period for %K',
      min: 1,
      max: 50,
      step: 1,
    },
    dPeriod: {
      type: 'number',
      label: '%D Period',
      defaultValue: 3,
      description: 'Smoothing period for %D signal line',
      min: 1,
      max: 50,
      step: 1,
    },
    kColor: {
      type: 'color',
      label: '%K Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the %K line',
    },
    dColor: {
      type: 'color',
      label: '%D Line Color',
      defaultValue: '#ef4444',
      description: 'Color of the %D signal line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the indicator lines',
      min: 1,
      max: 5,
      step: 1,
    },
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

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: stochRSIValues[i]?.k ?? NaN,
        signal: stochRSIValues[i]?.d ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
