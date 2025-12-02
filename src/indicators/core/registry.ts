import {
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorCategory,
  IndicatorMetadata,
} from './types';

class IndicatorRegistry {
  private indicators: Map<string, IndicatorDefinition> = new Map();
  private instanceCounters: Map<string, number> = new Map();

  register(definition: IndicatorDefinition): void {
    if (this.indicators.has(definition.metadata.id)) {
      console.warn(
        `Indicator with id "${definition.metadata.id}" is already registered. Overwriting.`
      );
    }
    this.indicators.set(definition.metadata.id, definition);
  }

  unregister(id: string): boolean {
    return this.indicators.delete(id);
  }

  get(id: string): IndicatorDefinition | undefined {
    return this.indicators.get(id);
  }

  getAll(): IndicatorDefinition[] {
    return Array.from(this.indicators.values());
  }

  getByCategory(category: IndicatorCategory): IndicatorDefinition[] {
    return this.getAll().filter(
      (indicator) => indicator.metadata.category === category
    );
  }

  search(query: string): IndicatorDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (indicator) =>
        indicator.metadata.name.toLowerCase().includes(lowerQuery) ||
        indicator.metadata.description.toLowerCase().includes(lowerQuery)
    );
  }

  createInstance(definitionId: string, customSettings?: Record<string, any>): IndicatorInstance {
    const definition = this.get(definitionId);
    if (!definition) {
      throw new Error(`Indicator definition "${definitionId}" not found`);
    }

    const currentCount = this.instanceCounters.get(definitionId) || 0;
    const newCount = currentCount + 1;
    this.instanceCounters.set(definitionId, newCount);

    const instanceId = `${definitionId}-${newCount}`;

    const defaultSettings: Record<string, any> = {};
    Object.entries(definition.settings).forEach(([key, field]) => {
      defaultSettings[key] = field.defaultValue;
    });

    const settings = { ...defaultSettings, ...customSettings };

    return {
      id: instanceId,
      definitionId,
      name: `${definition.metadata.name}(${newCount})`,
      settings,
    };
  }

  validateSettings(definitionId: string, settings: Record<string, any>): boolean {
    const definition = this.get(definitionId);
    if (!definition) {
      return false;
    }

    for (const [key, field] of Object.entries(definition.settings)) {
      const value = settings[key];

      if (value === undefined) {
        return false;
      }

      if (field.type === 'number') {
        if (typeof value !== 'number') return false;
        if (field.min !== undefined && value < field.min) return false;
        if (field.max !== undefined && value > field.max) return false;
      } else if (field.type === 'boolean') {
        if (typeof value !== 'boolean') return false;
      } else if (field.type === 'color' || field.type === 'lineStyle') {
        if (typeof value !== 'string') return false;
      } else if (field.type === 'select') {
        if (typeof value !== 'string') return false;
        if (field.options && !field.options.some(opt => opt.value === value)) {
          return false;
        }
      }
    }

    return true;
  }

  getMetadataList(): IndicatorMetadata[] {
    return this.getAll().map((indicator) => indicator.metadata);
  }

  clear(): void {
    this.indicators.clear();
    this.instanceCounters.clear();
  }
}

export const indicatorRegistry = new IndicatorRegistry();
