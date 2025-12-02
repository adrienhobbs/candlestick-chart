import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { donchianchannels } from 'fast-technical-indicators';

export const DonchianChannelsIndicator: IndicatorDefinition = {
  metadata: {
    id: 'donchian',
    name: 'Donchian Channels',
    description: 'Highest high and lowest low over a period - classic breakout indicator',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars to look back',
      min: 2,
      max: 200,
      step: 1,
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
    fillBands: {
      upper: 'upper',
      lower: 'lower',
    },
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);

    const donchianValues = donchianchannels({
      high,
      low,
      period: settings.period,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: donchianValues[i]?.middle ?? NaN,
        upper: donchianValues[i]?.upper ?? NaN,
        lower: donchianValues[i]?.lower ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
