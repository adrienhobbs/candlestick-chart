import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { BAND_FILL } from '../../constants/colors';
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
    period: numberSetting({
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars to look back',
      min: 2,
      max: 200,
      step: 1,
    }),
    upperColor: colorSetting('Upper Band Color', '#ef4444', 'Color of the upper band'),
    middleColor: colorSetting('Middle Line Color', '#3b82f6', 'Color of the middle line'),
    lowerColor: colorSetting('Lower Band Color', '#10b981', 'Color of the lower band'),
    lineWidth: lineWidthSetting(2, 'Width of the channel lines'),
    showFill: {
      type: 'boolean',
      label: 'Show Fill',
      defaultValue: true,
      description: 'Fill area between bands',
    },
    fillColor: colorSetting('Fill Color', BAND_FILL, 'Color of the channel fill'),
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

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: donchianValues[i]?.middle ?? NaN,
      upper: donchianValues[i]?.upper ?? NaN,
      lower: donchianValues[i]?.lower ?? NaN,
    }));
  },
};
