import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { ichimokucloud } from 'fast-technical-indicators';

export const IchimokuIndicator: IndicatorDefinition = {
  metadata: {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    description: 'Comprehensive trend system with conversion, base, and span lines forming a cloud',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    conversionPeriod: {
      type: 'number',
      label: 'Conversion Period (Tenkan)',
      defaultValue: 9,
      description: 'Period for conversion line',
      min: 1,
      max: 100,
      step: 1,
    },
    basePeriod: {
      type: 'number',
      label: 'Base Period (Kijun)',
      defaultValue: 26,
      description: 'Period for base line',
      min: 1,
      max: 100,
      step: 1,
    },
    spanPeriod: {
      type: 'number',
      label: 'Span Period (Senkou)',
      defaultValue: 52,
      description: 'Period for span B',
      min: 1,
      max: 200,
      step: 1,
    },
    displacement: {
      type: 'number',
      label: 'Displacement',
      defaultValue: 26,
      description: 'Forward displacement for span lines',
      min: 0,
      max: 100,
      step: 1,
    },
    conversionColor: {
      type: 'color',
      label: 'Conversion Line Color',
      defaultValue: '#3b82f6',
      description: 'Color of the conversion line',
    },
    baseColor: {
      type: 'color',
      label: 'Base Line Color',
      defaultValue: '#ef4444',
      description: 'Color of the base line',
    },
    spanAColor: {
      type: 'color',
      label: 'Span A Color',
      defaultValue: '#10b981',
      description: 'Color of span A (cloud edge)',
    },
    spanBColor: {
      type: 'color',
      label: 'Span B Color',
      defaultValue: '#f59e0b',
      description: 'Color of span B (cloud edge)',
    },
    lineWidth: {
      type: 'number',
      label: 'Line Width',
      defaultValue: 2,
      description: 'Width of the indicator lines',
      min: 1,
      max: 5,
      step: 1,
    },
    showCloud: {
      type: 'boolean',
      label: 'Show Cloud',
      defaultValue: true,
      description: 'Fill area between span A and span B',
    },
    cloudColor: {
      type: 'color',
      label: 'Cloud Color',
      defaultValue: 'rgba(59, 130, 246, 0.1)',
      description: 'Color of the cloud fill',
    },
  },
  renderConfig: {
    seriesType: ChartSeriesType.LINE,
    outputCount: 5,
    overlay: true,
    hasBandFill: true,
    fillBands: {
      upper: 'spanA',
      lower: 'spanB',
    },
  },
  calculate: (bars, settings) => {
    const high = bars.map(bar => bar.high);
    const low = bars.map(bar => bar.low);

    const ichimokuValues = ichimokucloud({
      high,
      low,
      conversionPeriod: settings.conversionPeriod,
      basePeriod: settings.basePeriod,
      spanPeriod: settings.spanPeriod,
      displacement: settings.displacement,
    });

    return bars
      .map((bar, i) => ({
        time: bar.timestamp / 1000,
        value: ichimokuValues[i]?.conversion ?? NaN,
        base: ichimokuValues[i]?.base ?? NaN,
        spanA: ichimokuValues[i]?.spanA ?? NaN,
        spanB: ichimokuValues[i]?.spanB ?? NaN,
      }))
      .filter((point) => !isNaN(point.value));
  },
};
