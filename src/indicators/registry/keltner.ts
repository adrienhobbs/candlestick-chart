import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { BAND_FILL } from '../../constants/colors';
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
    period: numberSetting({
      label: 'Period',
      defaultValue: 20,
      description: 'Period for middle line (EMA)',
      min: 2,
      max: 200,
      step: 1,
    }),
    atrPeriod: numberSetting({
      label: 'ATR Period',
      defaultValue: 10,
      description: 'Period for ATR calculation',
      min: 1,
      max: 100,
      step: 1,
    }),
    atrMultiplier: numberSetting({
      label: 'ATR Multiplier',
      defaultValue: 2,
      description: 'Multiplier for channel width',
      min: 0.1,
      max: 10,
      step: 0.1,
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
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    // `fast-technical-indicators` ships loose/incorrect types for keltnerchannel's
    // options; the runtime shape below is correct, so cast at this 3rd-party boundary.
    const keltnerValues = keltnerchannel({
      high,
      low,
      close,
      period: settings.period,
      atrPeriod: settings.atrPeriod,
      multiplier: settings.atrMultiplier,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: keltnerValues[i]?.middle ?? NaN,
      upper: keltnerValues[i]?.upper ?? NaN,
      lower: keltnerValues[i]?.lower ?? NaN,
    }));
  },
};
