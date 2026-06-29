import {
  IndicatorDefinition,
  IndicatorCategory,
  ChartSeriesType,
} from '../core/types';
import { numberSetting, colorSetting, lineWidthSetting } from '../core/settings';
import { OHLCVBar } from '../../types/chart';

type ResetPeriod = 'none' | 'daily' | 'weekly' | 'monthly';

function calculateVWAPWithBands(
  bars: OHLCVBar[],
  {
    reset = 'none' as ResetPeriod,
    bandMultiplier = 1,
    includeBands = true,
  }: {
    reset?: ResetPeriod;
    bandMultiplier?: number;
    includeBands?: boolean;
  }
) {
  if (!bars.length) return { vwap: [], upper: [], lower: [] };

  let cumulativeVolume = 0;
  let cumulativeTPV = 0;
  let sessionPrices: number[] = [];

  const vwap: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  const getWeek = (d: Date) => {
    const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = day.getUTCDay() || 7;
    day.setUTCDate(day.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
  };

  const std = (arr: number[]) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  };

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const typical = (bar.high + bar.low + bar.close) / 3;

    if (i > 0 && reset !== 'none') {
      const prev = new Date(bars[i - 1].timestamp);
      const curr = new Date(bar.timestamp);
      let resetFlag = false;

      if (reset === 'daily') {
        resetFlag =
          curr.getDate() !== prev.getDate() ||
          curr.getMonth() !== prev.getMonth() ||
          curr.getFullYear() !== prev.getFullYear();
      } else if (reset === 'weekly') {
        resetFlag =
          getWeek(curr) !== getWeek(prev) ||
          curr.getFullYear() !== prev.getFullYear();
      } else if (reset === 'monthly') {
        resetFlag =
          curr.getMonth() !== prev.getMonth() ||
          curr.getFullYear() !== prev.getFullYear();
      }

      if (resetFlag) {
        cumulativeVolume = 0;
        cumulativeTPV = 0;
        sessionPrices = [];
      }
    }

    cumulativeTPV += typical * bar.volume;
    cumulativeVolume += bar.volume;
    sessionPrices.push(typical);

    const vwapValue = cumulativeTPV / cumulativeVolume;
    vwap.push(vwapValue);

    if (includeBands && sessionPrices.length > 1) {
      const sigma = std(sessionPrices);
      upper.push(vwapValue + sigma * bandMultiplier);
      lower.push(vwapValue - sigma * bandMultiplier);
    } else {
      upper.push(NaN);
      lower.push(NaN);
    }
  }

  return { vwap, upper, lower };
}

export const VWAPIndicator: IndicatorDefinition = {
  metadata: {
    id: 'vwap',
    name: 'VWAP',
    description: 'Volume Weighted Average Price with standard deviation bands',
    category: IndicatorCategory.VOLUME,
    version: '1.0.0',
  },
  settings: {
    reset: {
      type: 'select',
      label: 'Reset Period',
      defaultValue: 'daily',
      description: 'When to reset VWAP calculation',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
      ],
    },
    bandMultiplier: numberSetting({
      label: 'Band Multiplier',
      defaultValue: 1,
      description: 'Standard deviation multiplier for bands',
      min: 0.5,
      max: 5,
      step: 0.1,
    }),
    showBands: {
      type: 'boolean',
      label: 'Show Bands',
      defaultValue: true,
      description: 'Show standard deviation bands',
    },
    vwapColor: colorSetting('VWAP Color', '#f59e0b', 'Color of the VWAP line'),
    upperColor: colorSetting('Upper Band Color', '#ef4444', 'Color of the upper band'),
    lowerColor: colorSetting('Lower Band Color', '#10b981', 'Color of the lower band'),
    lineWidth: lineWidthSetting(2, 'Width of the lines'),
    showFill: {
      type: 'boolean',
      label: 'Show Fill',
      defaultValue: true,
      description: 'Show shaded area between bands',
    },
    fillColor: colorSetting('Fill Color', 'rgba(245, 158, 11, 0.1)', 'Color of the shaded area between bands'),
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
    const { vwap, upper, lower } = calculateVWAPWithBands(bars, {
      reset: settings.reset as ResetPeriod,
      bandMultiplier: settings.bandMultiplier,
      includeBands: settings.showBands,
    });

    return bars.map((bar, i) => ({
      time: bar.timestamp / 1000,
      value: vwap[i],
      upper: upper[i],
      lower: lower[i],
    }));
  },
};
