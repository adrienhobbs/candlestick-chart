import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { keltnerchannel } from 'fast-technical-indicators';

export const KeltnerChannelsIndicator: IndicatorDefinition = {
  metadata: {
    id: 'keltner',
    name: 'Keltner Channels',
    description: 'Volatility-based channels using ATR - similar to Bollinger Bands',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      description: 'Period for middle line (EMA)',
      min: 2,
      max: 200,
      step: 1,
    },
    atrPeriod: {
      type: 'number',
      label: 'ATR Period',
      defaultValue: 10,
      description: 'Period for ATR calculation',
      min: 1,
      max: 100,
      step: 1,
    },
    atrMultiplier: {
      type: 'number',
      label: 'ATR Multiplier',
      defaultValue: 2,
      description: 'Multiplier for channel width',
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    upperColor: {
      type: 'color',
      label: 'Upper Band Color',
      defaultValue: '#ef4444',
      description: 'Color of the upper band',
    },
    middleColor: {
      type: 'color',
      label: 'Middle Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the middle line',
    },
    lowerColor: {
      type: 'color',
      label: 'Lower Band Color',
      defaultValue: '#10b981',
      description: 'Color of the lower band',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the channel lines',
      min: 1,
      max: 5,
      step: 1,
    },
    showFill: {
      type: 'boolean',
      label: 'Show Fill',
      defaultValue: true,
      description: 'Fill area between bands',
    },
    fillColor: {
      type: 'color',
      label: 'Fill Color',
      defaultValue: 'rgba(59, 130, 246, 0.1)',
      description: 'Color of the channel fill',
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 3,
    overlay: true,
    hasBandFill: true,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    const keltnerValues = keltnerchannel({
      high,
      low,
      close,
      period: settings.period,
      atrPeriod: settings.atrPeriod,
      multiplier: settings.atrMultiplier,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: keltnerValues[i]?.middle ?? NaN,
      upper: keltnerValues[i]?.upper ?? NaN,
      lower: keltnerValues[i]?.lower ?? NaN,
    }));
  },
};
