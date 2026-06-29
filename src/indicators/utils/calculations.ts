import { OHLCVBar } from '../../types/chart';

export function padIndicatorArray(result: number[], barsLength: number): number[] {
  const missing = barsLength - result.length;
  if (missing <= 0) return result;
  return [...Array(missing).fill(NaN), ...result];
}

export function displaceArray(arr: number[], offset: number): number[] {
  if (offset <= 0) return arr;
  return [...arr.slice(offset), ...Array(offset).fill(NaN)];
}

export function calculateSMA(bars: OHLCVBar[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += bars[i - j].close;
      }
      result.push(sum / period);
    }
  }

  return result;
}

export function calculateEMA(bars: OHLCVBar[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  let ema = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += bars[i - j].close;
      }
      ema = sum / period;
      result.push(ema);
    } else {
      ema = (bars[i].close - ema) * multiplier + ema;
      result.push(ema);
    }
  }

  return result;
}

/**
 * Wilder's Relative Strength Index (the canonical RSI used by trading platforms).
 *
 * Returns one value per bar: `NaN` for indices `< period` (not enough data), then
 * the first RSI at index `period` (seeded from the simple average of the first
 * `period` gains/losses) and Wilder-smoothed thereafter. RSI = 100 − 100/(1+RS),
 * RS = avgGain/avgLoss; a zero average loss yields 100.
 */
export function calculateRSI(bars: OHLCVBar[], period: number): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  if (period <= 0 || bars.length <= period) return result;

  // Consecutive close-to-close changes; `changes[k]` is `close[k+1] − close[k]`,
  // so the change *into* bar `i` is `changes[i - 1]`.
  const changes: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    changes.push(bars[i].close - bars[i - 1].close);
  }

  const rsiFrom = (avgGain: number, avgLoss: number): number =>
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Seed at index `period`: simple average of the first `period` changes.
  let avgGain = 0;
  let avgLoss = 0;
  for (let k = 0; k < period; k++) {
    const change = changes[k];
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = rsiFrom(avgGain, avgLoss);

  // Wilder smoothing for the remaining bars.
  for (let i = period + 1; i < bars.length; i++) {
    const change = changes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = rsiFrom(avgGain, avgLoss);
  }

  return result;
}

export function calculateStandardDeviation(values: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1 || isNaN(values[i])) {
      result.push(NaN);
    } else {
      let sum = 0;
      let count = 0;

      for (let j = 0; j < period; j++) {
        const val = values[i - j];
        if (!isNaN(val)) {
          sum += val;
          count++;
        }
      }

      const mean = sum / count;
      let squaredDiffSum = 0;

      for (let j = 0; j < period; j++) {
        const val = values[i - j];
        if (!isNaN(val)) {
          squaredDiffSum += Math.pow(val - mean, 2);
        }
      }

      const variance = squaredDiffSum / count;
      result.push(Math.sqrt(variance));
    }
  }

  return result;
}

export function calculateBollingerBands(
  bars: OHLCVBar[],
  period: number,
  stdDev: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(bars, period);
  const closes = bars.map((b) => b.close);
  const std = calculateStandardDeviation(closes, period);

  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < middle.length; i++) {
    if (isNaN(middle[i]) || isNaN(std[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      upper.push(middle[i] + std[i] * stdDev);
      lower.push(middle[i] - std[i] * stdDev);
    }
  }

  return { upper, middle, lower };
}
