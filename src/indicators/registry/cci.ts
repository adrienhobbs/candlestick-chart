import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { cci } from 'fast-technical-indicators';

export const CCIIndicator: IndicatorDefinition = {
  metadata: {
    id: 'cci',
    name: 'CCI',
    description: 'Commodity Channel Index - identifies cyclical trends and overbought/oversold levels',
    category: IndicatorCategory.OSCILLATORS,
    version: '1.0.0',
  },
  settings: {
    period: {
      type: 'number',
      label: 'Period',
      defaultValue: 20,
      description: 'Number of bars for CCI calculation',
      min: 2,
      max: 100,
      step: 1,
    },
    color: {
      type: 'color',
      label: 'Line Color',
      defaultValue: '#ec4899',
      description: 'Color of the CCI line',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the CCI line',
      min: 1,
      max: 5,
      step: 1,
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 1,
    overlay: false,
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);
    const close = bars.map(bar => bar.close);

    const cciValues = cci({
      high,
      low,
      close,
      period: settings.period,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: cciValues[i] ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
