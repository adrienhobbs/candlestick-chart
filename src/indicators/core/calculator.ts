import { OHLCVBar } from '../../types/chart';
import { IndicatorInstance, IndicatorOutput } from './types';
import { indicatorRegistry } from './registry';

interface CacheEntry {
  data: IndicatorOutput[];
  settingsHash: string;
  dataLength: number;
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
    const cacheKey = instance.id;
    const cached = this.cache.get(cacheKey);

    if (
      cached &&
      cached.settingsHash === settingsHash &&
      cached.dataLength === bars.length
    ) {
      return cached.data;
    }

    try {
      const data = definition.calculate(bars, instance.settings);

      this.cache.set(cacheKey, {
        data,
        settingsHash,
        dataLength: bars.length,
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
