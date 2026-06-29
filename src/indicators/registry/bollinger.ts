import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { BAND_FILL } from '../../constants/colors';
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
    period: numberSetting({
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars for moving average',
      min: 2,
      max: 200,
      step: 1,
    }),
    stdDev: numberSetting({
      label: 'Standard Deviation',
      defaultValue: 2,
      description: 'Number of standard deviations for bands',
      min: 0.5,
      max: 5,
      step: 0.1,
    }),
    upperColor: colorSetting('Upper Band Color', '#ef4444', 'Color of the upper band'),
    middleColor: colorSetting('Middle Band Color', '#3b82f6', 'Color of the middle band'),
    lowerColor: colorSetting('Lower Band Color', '#10b981', 'Color of the lower band'),
    lineWidth: lineWidthSetting(2, 'Width of the band lines'),
    showFill: {
      type: 'boolean',
      label: 'Show Fill',
      defaultValue: true,
      description: 'Show shaded area between bands',
    },
    fillColor: colorSetting('Fill Color', BAND_FILL, 'Color of the shaded area between bands'),
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
