import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  indicatorRegistry,
  registerBuiltInIndicators,
  IndicatorCategory,
  ChartSeriesType,
  type IndicatorDefinition,
} from '../index';

const makeDef = (id: string, name: string, description = 'desc'): IndicatorDefinition => ({
  metadata: { id, name, description, category: IndicatorCategory.TREND, version: '1.0.0' },
  settings: {
    period: { type: 'number', label: 'Period', defaultValue: 5, min: 1, max: 10, step: 1 },
  },
  renderConfig: { seriesType: ChartSeriesType.LINE, outputCount: 1, overlay: true },
  calculate: () => [],
});

describe('indicatorRegistry', () => {
  beforeEach(() => {
    indicatorRegistry.clear();
  });

  it('registers then retrieves a definition by id', () => {
    const def = makeDef('custom-x', 'Custom X');
    indicatorRegistry.register(def);
    expect(indicatorRegistry.get('custom-x')).toBe(def);
    expect(indicatorRegistry.getAll()).toHaveLength(1);
  });

  it('returns undefined for an unknown id', () => {
    expect(indicatorRegistry.get('does-not-exist')).toBeUndefined();
  });

  it('searches by name and description (case-insensitive)', () => {
    indicatorRegistry.register(makeDef('alpha', 'Alpha Trend', 'momentum thing'));
    indicatorRegistry.register(makeDef('beta', 'Beta Band', 'volatility thing'));
    expect(indicatorRegistry.search('alpha').map((d) => d.metadata.id)).toEqual(['alpha']);
    expect(indicatorRegistry.search('THING')).toHaveLength(2);
    expect(indicatorRegistry.search('nomatch')).toHaveLength(0);
  });

  it('warns and overwrites on duplicate id (no duplicate entries)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    indicatorRegistry.register(makeDef('dup', 'First'));
    indicatorRegistry.register(makeDef('dup', 'Second'));
    expect(warn).toHaveBeenCalledOnce();
    expect(indicatorRegistry.getAll()).toHaveLength(1);
    expect(indicatorRegistry.get('dup')!.metadata.name).toBe('Second');
    warn.mockRestore();
  });

  it('createInstance throws for an unknown definition id', () => {
    expect(() => indicatorRegistry.createInstance('missing')).toThrow();
  });

  it('createInstance applies default settings and increments instance ids', () => {
    indicatorRegistry.register(makeDef('inst', 'Inst'));
    const a = indicatorRegistry.createInstance('inst');
    const b = indicatorRegistry.createInstance('inst', { period: 9 });
    expect(a.id).toBe('inst-1');
    expect(a.settings.period).toBe(5); // default
    expect(b.id).toBe('inst-2');
    expect(b.settings.period).toBe(9); // custom override
  });

  it('validateSettings enforces type/min/max', () => {
    indicatorRegistry.register(makeDef('val', 'Val'));
    expect(indicatorRegistry.validateSettings('val', { period: 5 })).toBe(true);
    expect(indicatorRegistry.validateSettings('val', { period: 99 })).toBe(false); // > max
    expect(indicatorRegistry.validateSettings('val', { period: 'x' })).toBe(false); // wrong type
    expect(indicatorRegistry.validateSettings('val', {})).toBe(false); // missing
  });

  it('registerBuiltInIndicators registers all 22 built-ins', () => {
    registerBuiltInIndicators();
    expect(indicatorRegistry.getAll()).toHaveLength(22);
    // a few spot checks
    expect(indicatorRegistry.get('sma')).toBeDefined();
    expect(indicatorRegistry.get('ema')).toBeDefined();
    expect(indicatorRegistry.get('macd')).toBeDefined();
    expect(indicatorRegistry.get('bollinger')).toBeDefined();
  });
});
