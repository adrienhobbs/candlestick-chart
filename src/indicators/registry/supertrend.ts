import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { supertrend } from 'fast-technical-indicators';

export const SuperTrendIndicator: IndicatorDefinition = {
  metadata: {
    id: 'supertrend',
    name: 'SuperTrend',
    description: 'Modern trend-following indicator with clear buy/sell signals',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 10,
      description: 'Period for ATR calculation',
      min: 1,
      max: 100,
      step: 1,
    },
    multiplier: {
      type: 'number',
      label: 'Multiplier',
      defaultValue: 3,
      description: 'ATR multiplier for bands',
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#06b6d4',
      description: 'Color of the SuperTrend line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the SuperTrend line',
      min: 1,
      max: 5,
      step: 1,
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: true,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    const supertrendValues = supertrend({
      high,
      low,
      close,
      period: settings.period,
      multiplier: settings.multiplier,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: supertrendValues[i]?.supertrend ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
