import { OHLCVBar } from '../../types/chart';
import { IndicatorInstance, IndicatorOutput } from './types';
import { indicatorRegistry } from './registry';

interface CacheEntry {
  data: IndicatorOutput[];
  settingsHash: string;
  barsFingerprint: string;
}

/**
 * Cheap O(1) identity for a bar series, used to decide whether a cached
 * indicator series still describes the bars being rendered.
 *
 * Bar COUNT alone is not an identity. Swapping the charted symbol — or jumping
 * to a different window of the same symbol — typically yields the same number
 * of bars (callers page by a fixed limit), so a count-keyed entry gets served
 * for completely different data: the previous symbol's values drawn over the
 * new symbol's candles, at the old symbol's price level.
 *
 * Anchoring on the first and last timestamps catches every symbol/window
 * change. Folding in the last bar's OHLCV additionally catches a live bar
 * mutating in place, where the timestamp deliberately does NOT move while the
 * price ticks.
 *
 * Deliberately O(1) rather than hashing every bar: `calculate` runs on each
 * render, so a full hash would cost as much as the work it is protecting. The
 * gap this leaves is a mutation strictly INSIDE the history that preserves
 * length and both endpoints; callers that do that must call `invalidateCache`.
 */
function fingerprintBars(bars: OHLCVBar[]): string {
  if (bars.length === 0) return '0';
  const first = bars[0];
  const last = bars[bars.length - 1];
  return [
    bars.length,
    first.timestamp,
    last.timestamp,
    last.open,
    last.high,
    last.low,
    last.close,
    last.volume,
  ].join(':');
}

class IndicatorCalculator {
  private cache: Map<string, CacheEntry> = new Map();

  private hashSettings(settings: Record<string, any>): string {
    return JSON.stringify(settings);
  }

  calculate(
    instance: IndicatorInstance,
    bars: OHLCVBar[]
  ): IndicatorOutput[] {
    const definition = indicatorRegistry.get(instance.definitionId);
    if (!definition) {
      console.error(
        `Indicator definition "${instance.definitionId}" not found`
      );
      return [];
    }

    const settingsHash = this.hashSettings(instance.settings);
    const barsFingerprint = fingerprintBars(bars);
    const cacheKey = instance.id;
    const cached = this.cache.get(cacheKey);

    if (
      cached &&
      cached.settingsHash === settingsHash &&
      cached.barsFingerprint === barsFingerprint
    ) {
      return cached.data;
    }

    try {
      const data = definition.calculate(bars, instance.settings);

      this.cache.set(cacheKey, {
        data,
        settingsHash,
        barsFingerprint,
      });

      return data;
    } catch (error) {
      console.error(
        `Error calculating indicator "${instance.definitionId}":`,
        error
      );
      return [];
    }
  }

  invalidateCache(instanceId?: string): void {
    if (instanceId) {
      this.cache.delete(instanceId);
    } else {
      this.cache.clear();
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const indicatorCalculator = new IndicatorCalculator();
