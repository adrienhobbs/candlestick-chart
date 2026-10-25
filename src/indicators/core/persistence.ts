import { IndicatorInstance } from './types';

export interface PersistenceAdapter {
  saveIndicators(indicators: IndicatorInstance[]): Promise<void>;
  loadIndicators(): Promise<IndicatorInstance[]>;
  deleteIndicator(id: string): Promise<void>;
}

/** The localStorage key used when none is given. */
export const DEFAULT_INDICATORS_STORAGE_KEY = 'chart_indicators';

export interface PersistenceAdapterOptions {
  /**
   * localStorage key (default `chart_indicators`). Give each chart that should keep
   * its own indicator set its own key; charts sharing a key share one set.
   */
  key?: string;
}

export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  private storageKey: string;

  constructor(storageKey: string = DEFAULT_INDICATORS_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  async saveIndicators(indicators: IndicatorInstance[]): Promise<void> {
    try {
      const serialized = JSON.stringify(indicators);
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      console.error('Error saving indicators to localStorage:', error);
    }
  }

  async loadIndicators(): Promise<IndicatorInstance[]> {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (!serialized) {
        return [];
      }

      const parsed = JSON.parse(serialized);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading indicators from localStorage:', error);
      return [];
    }
  }

  async deleteIndicator(id: string): Promise<void> {
    try {
      const indicators = await this.loadIndicators();
      const filtered = indicators.filter((ind) => ind.id !== id);
      await this.saveIndicators(filtered);
    } catch (error) {
      console.error('Error deleting indicator from localStorage:', error);
    }
  }
}

export class NoOpPersistenceAdapter implements PersistenceAdapter {
  async saveIndicators(_indicators: IndicatorInstance[]): Promise<void> {
  }

  async loadIndicators(): Promise<IndicatorInstance[]> {
    return [];
  }

  async deleteIndicator(_id: string): Promise<void> {
  }
}

export function createPersistenceAdapter(
  kind: 'noop' | 'localStorage',
  options: PersistenceAdapterOptions = {},
): PersistenceAdapter {
  switch (kind) {
    case 'localStorage':
      return new LocalStoragePersistenceAdapter(options.key);
    case 'noop':
      return new NoOpPersistenceAdapter();
    default:
      throw new Error('Unknown persistence kind: ' + kind);
  }
}
