import { describe, expect, it } from 'vitest';
import { IndicatorInstanceSchema } from './types';

describe('IndicatorInstanceSchema enabled flag', () => {
  it('accepts an instance without enabled (pre-toggle saved sets load as enabled)', () => {
    const r = IndicatorInstanceSchema.safeParse({ id: 'a', definitionId: 'sma', name: 'SMA', settings: {} });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBeUndefined();
  });

  it('round-trips an explicit enabled flag', () => {
    const r = IndicatorInstanceSchema.safeParse({
      id: 'a',
      definitionId: 'sma',
      name: 'SMA',
      settings: {},
      enabled: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(false);
  });
});
