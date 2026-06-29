import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { BAND_FILL } from '../../constants/colors';
import { ichimokucloud } from 'fast-technical-indicators';
import { displaceArray } from '../utils/calculations';

export const IchimokuIndicator: IndicatorDefinition = {
  metadata: {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    description: 'Comprehensive trend system with conversion, base, and span lines forming a cloud',
    category: IndicatorCategory.TREND,
    version: '1.0.0',
  },
  settings: {
    conversionPeriod: numberSetting({
      label: 'Conversion Period (Tenkan)',
      defaultValue: 9,
      description: 'Period for conversion line',
      min: 1,
      max: 100,
      step: 1,
    }),
    basePeriod: numberSetting({
      label: 'Base Period (Kijun)',
      defaultValue: 26,
      description: 'Period for base line',
      min: 1,
      max: 100,
      step: 1,
    }),
    spanPeriod: numberSetting({
      label: 'Span Period (Senkou)',
      defaultValue: 52,
      description: 'Period for span B',
      min: 1,
      max: 200,
      step: 1,
    }),
    displacement: numberSetting({
      label: 'Displacement',
      defaultValue: 26,
      description: 'Forward displacement for span lines',
      min: 0,
      max: 100,
      step: 1,
    }),
    conversionColor: colorSetting('Conversion Line Color', '#3b82f6', 'Color of the conversion line'),
    baseColor: colorSetting('Base Line Color', '#ef4444', 'Color of the base line'),
    spanAColor: colorSetting('Span A Color', '#10b981', 'Color of span A (cloud edge)'),
    spanBColor: colorSetting('Span B Color', '#f59e0b', 'Color of span B (cloud edge)'),
    lineWidth: lineWidthSetting(2, 'Width of the indicator lines'),
    showCloud: {
      type: 'boolean',
      label: 'Show Cloud',
      defaultValue: true,
      description: 'Fill area between span A and span B',
    },
    cloudColor: colorSetting('Cloud Color', BAND_FILL, 'Color of the cloud fill'),
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
      displacement: 0,
    });

    const conversion = bars.map((_, i) => ichimokuValues[i]?.conversion ?? NaN);
    const base = bars.map((_, i) => ichimokuValues[i]?.base ?? NaN);
    const spanA = bars.map((_, i) => ichimokuValues[i]?.spanA ?? NaN);
    const spanB = bars.map((_, i) => ichimokuValues[i]?.spanB ?? NaN);

    const displacedSpanA = displaceArray(spanA, settings.displacement);
    const displacedSpanB = displaceArray(spanB, settings.displacement);

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: conversion[i],
      base: base[i],
      spanA: displacedSpanA[i],
      spanB: displacedSpanB[i],
    }));
  },
};
