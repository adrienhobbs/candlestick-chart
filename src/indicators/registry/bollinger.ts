import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { calculateBollingerBands } from '../utils/calculations';

export const BollingerBandsIndicator: IndicatorDefinition = {
  metadata: {
    id: 'bollinger',
    name: 'Bollinger Bands',
    description: 'Bollinger Bands - volatility bands placed above and below a moving average',
    category: IndicatorCategory.VOLATILITY,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars for moving average',
      min: 2,
      max: 200,
      step: 1,
    },
    stdDev: {
      type: 'number',
      label: 'Standard Deviation',
      defaultValue: 2,
      description: 'Number of standard deviations for bands',
      min: 0.5,
      max: 5,
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
      label: 'Middle Band Color',
      defaultValue: '#3b82f6',
      description: 'Color of the middle band',
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
      description: 'Width of the band lines',
      min: 1,
      max: 5,
      step: 1,
    },
    showFill: {
      type: 'boolean',
      label: 'Show Fill',
      defaultValue: true,
      description: 'Show shaded area between bands',
    },
    fillColor: {
      type: 'color',
      label: 'Fill Color',
      defaultValue: 'rgba(59, 130, 246, 0.1)',
      description: 'Color of the shaded area between bands',
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
    const { upper, middle, lower } = calculateBollingerBands(
      bars,
      settings.period,
      settings.stdDev
    );

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: middle[i],
      upper: upper[i],
      lower: lower[i],
    }));
  },
};
