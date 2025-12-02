import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { macd } from 'fast-technical-indicators';

export const MACDIndicator: IndicatorDefinition = {
  metadata: {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence - trend-following momentum indicator',
    category: IndicatorCategory.MOMENTUM,
    version: '1.0.0',
  },
  settings: {
    fastPeriod: {
      type: 'number',
      label: 'Fast Period',
      defaultValue: 12,
      description: 'Period for fast EMA',
      min: 2,
      max: 100,
      step: 1,
    },
    slowPeriod: {
      type: 'number',
      label: 'Slow Period',
      defaultValue: 26,
      description: 'Period for slow EMA',
      min: 2,
      max: 100,
      step: 1,
    },
    signalPeriod: {
      type: 'number',
      label: 'Signal Period',
      defaultValue: 9,
      description: 'Period for signal line',
      min: 1,
      max: 50,
      step: 1,
    },
    macdColor: {
      type: 'color',
      label: 'MACD Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the MACD line',
    },
    signalColor: {
      type: 'color',
      label: 'Signal Line Color',
      defaultValue: '#ef4444',
      description: 'Color of the signal line',
    },
    histogramColor: {
      type: 'color',
      label: 'Histogram Color',
      defaultValue: '#10b981',
      description: 'Color of the histogram',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the MACD and signal lines',
      min: 1,
      max: 5,
      step: 1,
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 3,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const values = bars.map(bar => bar.close);

    const macdValues = macd({
      values,
      fastPeriod: settings.fastPeriod,
      slowPeriod: settings.slowPeriod,
      signalPeriod: settings.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: macdValues[i]?.MACD ?? NaN,
        signal: macdValues[i]?.signal ?? NaN,
        histogram: macdValues[i]?.histogram ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
