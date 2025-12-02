import { IndicatorInstance, IndicatorInstanceSchema } from './types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface PersistenceAdapter {
  saveIndicators(indicators: IndicatorInstance[]): Promise<void>;
  loadIndicators(): Promise<IndicatorInstance[]>;
  deleteIndicator(id: string): Promise<void>;
}

export class SupabasePersistenceAdapter implements PersistenceAdapter {
  private client: SupabaseClient;
  private tableName = 'user_indicators';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async saveIndicators(indicators: IndicatorInstance[]): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        console.warn('No authenticated user, skipping indicator save');
        return;
      }

      const records = indicators.map((indicator) => ({
        user_id: user.id,
        indicator_id: indicator.id,
        definition_id: indicator.definitionId,
        name: indicator.name,
        settings: indicator.settings,
      }));

      const { error } = await this.client
        .from(this.tableName)
        .upsert(records, { onConflict: 'user_id,indicator_id' });

      if (error) {
        console.error('Error saving indicators:', error);
      }
    } catch (error) {
      console.error('Error in saveIndicators:', error);
    }
  }

  async loadIndicators(): Promise<IndicatorInstance[]> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading indicators:', error);
        return [];
      }

      if (!data) {
        return [];
      }

      return data.map((record: any) => ({
        id: record.indicator_id,
        definitionId: record.definition_id,
        name: record.name,
        settings: record.settings,
      }));
    } catch (error) {
      console.error('Error in loadIndicators:', error);
      return [];
    }
  }

  async deleteIndicator(id: string): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        return;
      }

      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('user_id', user.id)
        .eq('indicator_id', id);

      if (error) {
        console.error('Error deleting indicator:', error);
      }
    } catch (error) {
      console.error('Error in deleteIndicator:', error);
    }
  }
}

export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  private storageKey = 'chart_indicators';

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
  async saveIndicators(indicators: IndicatorInstance[]): Promise<void> {
  }

  async loadIndicators(): Promise<IndicatorInstance[]> {
    return [];
  }

  async deleteIndicator(id: string): Promise<void> {
  }
}

export function createPersistenceAdapter(
  type: 'supabase' | 'localStorage' | 'none',
  options?: { supabaseUrl?: string; supabaseKey?: string }
): PersistenceAdapter {
  switch (type) {
    case 'supabase':
      if (!options?.supabaseUrl || !options?.supabaseKey) {
        throw new Error('Supabase URL and key are required for Supabase adapter');
      }
      return new SupabasePersistenceAdapter(options.supabaseUrl, options.supabaseKey);
    case 'localStorage':
      return new LocalStoragePersistenceAdapter();
    case 'none':
      return new NoOpPersistenceAdapter();
    default:
      throw new Error(`Unknown persistence adapter type: ${type}`);
  }
}
