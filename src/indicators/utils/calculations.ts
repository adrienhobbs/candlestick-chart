import { OHLCVBar } from '../../types/chart';

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
  let hasStarted = false;

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
      hasStarted = true;
    } else {
      ema = (bars[i].close - ema) * multiplier + ema;
      result.push(ema);
    }
  }

  return result;
}

export function calculateRSI(bars: OHLCVBar[], period: number): number[] {
  const result: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    changes.push(bars[i].close - bars[i - 1].close);
  }

  for (let i = 0; i < bars.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      let gains = 0;
      let losses = 0;

      for (let j = i - period; j < i; j++) {
        const change = changes[j - 1];
        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }

      const avgGain = gains / period;
      const avgLoss = losses / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        result.push(rsi);
      }
    }
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
