import { describe, it, expect, beforeAll } from 'vitest';
import { indicatorRegistry, registerBuiltInIndicators } from '../index';

/**
 * REGRESSION NET: pin the current built-in indicator default settings so any
 * future change to a default must be deliberate. Values asserted here were read
 * directly from the indicator definition files.
 */

const defaultOf = (id: string, key: string): unknown => {
  const def = indicatorRegistry.get(id);
  if (!def) throw new Error(`indicator "${id}" not registered`);
  const field = def.settings[key];
  if (!field) throw new Error(`indicator "${id}" has no setting "${key}"`);
  return field.defaultValue;
};

describe('built-in indicator default settings (locked)', () => {
  beforeAll(() => {
    indicatorRegistry.clear();
    registerBuiltInIndicators();
  });

  it('ema → period 12, color #10b981, lineWidth 2', () => {
    expect(defaultOf('ema', 'period')).toBe(12);
    expect(defaultOf('ema', 'color')).toBe('#10b981');
    expect(defaultOf('ema', 'lineWidth')).toBe(2);
  });

  it('sma → period 20 (color #3b82f6)', () => {
    expect(defaultOf('sma', 'period')).toBe(20);
    expect(defaultOf('sma', 'color')).toBe('#3b82f6');
  });

  it('rsi → period 14', () => {
    expect(defaultOf('rsi', 'period')).toBe(14);
  });

  it('macd → fastPeriod 12, slowPeriod 26, signalPeriod 9', () => {
    expect(defaultOf('macd', 'fastPeriod')).toBe(12);
    expect(defaultOf('macd', 'slowPeriod')).toBe(26);
    expect(defaultOf('macd', 'signalPeriod')).toBe(9);
  });

  it('bollinger → period 20, stdDev 2, fillColor rgba(59, 130, 246, 0.1)', () => {
    expect(defaultOf('bollinger', 'period')).toBe(20);
    expect(defaultOf('bollinger', 'stdDev')).toBe(2);
    expect(defaultOf('bollinger', 'fillColor')).toBe('rgba(59, 130, 246, 0.1)');
  });
});
