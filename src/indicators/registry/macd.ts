import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
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
    fastPeriod: numberSetting({
      label: 'Fast Period',
      defaultValue: 12,
      description: 'Period for fast EMA',
      min: 2,
      max: 100,
      step: 1,
    }),
    slowPeriod: numberSetting({
      label: 'Slow Period',
      defaultValue: 26,
      description: 'Period for slow EMA',
      min: 2,
      max: 100,
      step: 1,
    }),
    signalPeriod: numberSetting({
      label: 'Signal Period',
      defaultValue: 9,
      description: 'Period for signal line',
      min: 1,
      max: 50,
      step: 1,
    }),
    color: colorSetting('MACD Line Color', '#3b82f6', 'Color of the MACD line'),
    signalColor: colorSetting('Signal Line Color', '#ef4444', 'Color of the signal line'),
    histogramColor: colorSetting('Histogram Color', '#10b981', 'Color of the histogram'),
    lineWidth: lineWidthSetting(2, 'Width of the MACD and signal lines'),
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

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: macdValues[i]?.MACD ?? NaN,
      signal: macdValues[i]?.signal ?? NaN,
      histogram: macdValues[i]?.histogram ?? NaN,
    }));
  },
};
