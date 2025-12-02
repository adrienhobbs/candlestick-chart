import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
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
    period: {
      type: 'number',
      label: 'Period (K)',
      defaultValue: 14,
      description: 'Number of bars for %K calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    signalPeriod: {
      type: 'number',
      label: 'Signal Period (D)',
      defaultValue: 3,
      description: 'Number of bars for %D signal line',
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

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: stochValues[i]?.k ?? NaN,
        signal: stochValues[i]?.d ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
