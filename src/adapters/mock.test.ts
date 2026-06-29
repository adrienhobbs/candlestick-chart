import { describe, it, expect, vi } from 'vitest';
import { MockAdapter } from './mock';
import type { OHLCVBar } from '../types/chart';

describe('MockAdapter.fetchHistoricalBars', () => {
  it('returns the requested count with valid ascending OHLCV bars', async () => {
    const adapter = new MockAdapter();
    const bars = await adapter.fetchHistoricalBars({ symbol: 'AAPL', timeframe: '5Min', limit: 12 });

    expect(bars).toHaveLength(12);
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      expect(b.high).toBeGreaterThanOrEqual(b.low);
      expect(b.high).toBeGreaterThanOrEqual(b.open);
      expect(b.high).toBeGreaterThanOrEqual(b.close);
      expect(b.low).toBeLessThanOrEqual(b.open);
      expect(b.low).toBeLessThanOrEqual(b.close);
      expect(b.volume).toBeGreaterThan(0);
      if (i > 0) expect(b.timestamp).toBeGreaterThan(bars[i - 1].timestamp);
    }
  });
});

describe('MockAdapter.subscribeRealtime', () => {
  it('invokes onConnect immediately and onBar on each interval tick, stops after unsubscribe', () => {
    vi.useFakeTimers();
    try {
      const adapter = new MockAdapter();
      const onConnect = vi.fn();
      const onBar = vi.fn<(bar: OHLCVBar) => void>();

      const sub = adapter.subscribeRealtime('AAPL', { onConnect, onBar });
      expect(onConnect).toHaveBeenCalledTimes(1);
      expect(onBar).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(onBar).toHaveBeenCalledTimes(1);
      const bar = onBar.mock.calls[0][0];
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(typeof bar.timestamp).toBe('number');

      vi.advanceTimersByTime(5000);
      expect(onBar).toHaveBeenCalledTimes(2);

      sub.unsubscribe();
      vi.advanceTimersByTime(20000);
      expect(onBar).toHaveBeenCalledTimes(2); // no further ticks after unsubscribe
    } finally {
      vi.useRealTimers();
    }
  });
});
