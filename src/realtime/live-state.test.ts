import { describe, it, expect } from 'vitest';
import { DEFAULT_STALL_AFTER_MS, deriveStreamState } from './live-state';

const base = { connection: 'open' as const, tickSinceOpen: true, lastTickAt: 1_000, now: 2_000, stallAfterMs: 30_000 };

describe('deriveStreamState', () => {
  it('maps the connection and tick age to a stream state', () => {
    expect(deriveStreamState({ ...base, connection: 'closed' })).toBe('disconnected');
    expect(deriveStreamState({ ...base, connection: 'connecting' })).toBe('connecting');
    expect(deriveStreamState({ ...base, tickSinceOpen: false })).toBe('connecting');
    expect(deriveStreamState({ ...base, lastTickAt: null })).toBe('connecting');
    expect(deriveStreamState(base)).toBe('live');
    expect(deriveStreamState({ ...base, now: 31_000 })).toBe('stalled');
  });
});

describe('deriveStreamState stall threshold', () => {
  it('falls back to the default for a non-finite or non-positive stallAfterMs', () => {
    for (const stallAfterMs of [NaN, Infinity, 0, -5]) {
      expect(deriveStreamState({ ...base, stallAfterMs, now: 1_000 + DEFAULT_STALL_AFTER_MS - 1 })).toBe('live');
      expect(deriveStreamState({ ...base, stallAfterMs, now: 1_000 + DEFAULT_STALL_AFTER_MS })).toBe('stalled');
    }
    expect(DEFAULT_STALL_AFTER_MS).toBe(30_000);
  });
});
