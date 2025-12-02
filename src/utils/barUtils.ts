import { OHLCVBar } from '../types/chart';

export function validateBar(bar: any): bar is OHLCVBar {
  if (!bar || typeof bar !== 'object') return false;

  const required = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
  for (const field of required) {
    if (!(field in bar)) return false;
    if (typeof bar[field] !== 'number') return false;
  }

  if (bar.timestamp <= 0) return false;
  if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) return false;
  if (bar.volume < 0) return false;
  if (bar.high < bar.low) return false;
  if (bar.high < bar.open || bar.high < bar.close) return false;
  if (bar.low > bar.open || bar.low > bar.close) return false;

  return true;
}

export function isValidBar(bar: any): bar is OHLCVBar {
  return validateBar(bar);
}

export function normalizeTimestamp(timestamp: number): number {
  if (timestamp < 10000000000) {
    return timestamp * 1000;
  }
  return timestamp;
}

export function sortBars(bars: OHLCVBar[]): OHLCVBar[] {
  return [...bars].sort((a, b) => a.timestamp - b.timestamp);
}

export function deduplicateBars(bars: OHLCVBar[]): OHLCVBar[] {
  const seen = new Map<number, OHLCVBar>();

  for (const bar of bars) {
    const existing = seen.get(bar.timestamp);
    if (!existing) {
      seen.set(bar.timestamp, bar);
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function mergeBars(existingBars: OHLCVBar[], newBars: OHLCVBar[]): OHLCVBar[] {
  const allBars = [...existingBars, ...newBars];
  return deduplicateBars(allBars);
}

export function validateAndNormalizeBars(bars: any[]): OHLCVBar[] {
  console.log(`validateAndNormalizeBars: received ${bars.length} bars`);
  const validated = bars
    .filter(bar => {
      if (!validateBar(bar)) {
        console.warn('Invalid bar data:', bar);
        return false;
      }
      return true;
    })
    .map(bar => ({
      ...bar,
      timestamp: normalizeTimestamp(bar.timestamp),
    }));
  console.log(`validateAndNormalizeBars: returning ${validated.length} valid bars`);
  return validated;
}

export function updateBarInArray(bars: OHLCVBar[], updatedBar: OHLCVBar): OHLCVBar[] {
  const index = bars.findIndex(b => b.timestamp === updatedBar.timestamp);

  if (index === -1) {
    return [...bars, updatedBar].sort((a, b) => a.timestamp - b.timestamp);
  }

  const updated = [...bars];
  updated[index] = updatedBar;
  return updated;
}

export function appendBar(bars: OHLCVBar[], newBar: OHLCVBar): OHLCVBar[] {
  const exists = bars.find(b => b.timestamp === newBar.timestamp);
  if (exists) {
    return bars;
  }

  return [...bars, newBar];
}

export function prependBars(bars: OHLCVBar[], newBars: OHLCVBar[]): OHLCVBar[] {
  const existingTimestamps = new Set(bars.map(b => b.timestamp));
  const uniqueNewBars = newBars.filter(b => !existingTimestamps.has(b.timestamp));

  return [...uniqueNewBars, ...bars];
}

export function getOldestBar(bars: OHLCVBar[]): OHLCVBar | null {
  if (bars.length === 0) return null;
  return bars[0];
}

export function getNewestBar(bars: OHLCVBar[]): OHLCVBar | null {
  if (bars.length === 0) return null;
  return bars[bars.length - 1];
}

export function updateCurrentBar(
  bars: OHLCVBar[],
  tradePrice: number,
  tradeVolume: number
): OHLCVBar[] {
  if (bars.length === 0) return bars;

  const updated = [...bars];
  const lastBar = { ...updated[updated.length - 1] };

  lastBar.close = tradePrice;
  lastBar.high = Math.max(lastBar.high, tradePrice);
  lastBar.low = Math.min(lastBar.low, tradePrice);
  lastBar.volume += tradeVolume;

  updated[updated.length - 1] = lastBar;
  return updated;
}
