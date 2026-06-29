import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { colorSetting, lineWidthSetting } from '../core/settings';
import { obv } from 'fast-technical-indicators';

export const OBVIndicator: IndicatorDefinition = {
  metadata: {
    id: 'obv',
    name: 'OBV',
    description: 'On-Balance Volume - cumulative volume indicator showing buying/selling pressure',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    color: colorSetting('Line Color', '#10b981', 'Color of the OBV line'),
    lineWidth: lineWidthSetting(2, 'Width of the OBV line'),
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars) => {
    const close = bars.map(bar => bar.close);
    const volume = bars.map(bar => bar.volume || 0);

    const obvValues = obv({ close, volume });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: obvValues[i] ?? NaN,
    }));
  },
};
