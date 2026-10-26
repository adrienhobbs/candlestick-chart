import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBarsData } from './useBarsData';
import { MockAdapter } from '../adapters/mock';
import type { BarDataAdapter } from '../adapters/types';
import type { OHLCVBar } from '../types/chart';

describe('useBarsData', () => {
  it('fetchHistorical populates bars with the requested count', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useBarsData({ adapter, limit: 5 }));

    expect(result.current.bars).toHaveLength(0);

    await act(async () => {
      await result.current.fetchHistorical();
    });

    await waitFor(() => expect(result.current.bars).toHaveLength(5), { timeout: 2000 });
    expect(result.current.loading).toBe(false);
  });

  it('calling fetchHistorical twice does not duplicate bars (replaces, no `before`)', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useBarsData({ adapter, limit: 5 }));

    await act(async () => {
      await result.current.fetchHistorical();
    });
    await act(async () => {
      await result.current.fetchHistorical();
    });

    expect(result.current.bars).toHaveLength(5);
  });

  it('auto-fetch refetches on a symbol change and drops the previous symbol\'s late response', async () => {
    const pending = new Map<string, (bars: OHLCVBar[]) => void>();
    const calls: string[] = [];
    const adapter: BarDataAdapter = {
      fetchHistoricalBars: (params) =>
        new Promise((resolve) => {
          calls.push(params.symbol);
          pending.set(params.symbol, resolve);
        }),
    };
    const bar = (timestamp: number, close: number): OHLCVBar => ({
      timestamp, open: close, high: close, low: close, close, volume: 1,
    });

    const { result, rerender } = renderHook(
      ({ symbol }) => useBarsData({ adapter, symbol, autoFetch: true }),
      { initialProps: { symbol: 'AAA' } },
    );
    expect(calls).toEqual(['AAA']);

    rerender({ symbol: 'BBB' });
    expect(calls).toEqual(['AAA', 'BBB']);
    rerender({ symbol: 'BBB' });
    expect(calls).toEqual(['AAA', 'BBB']);

    await act(async () => {
      pending.get('BBB')!([bar(2000, 20)]);
    });
    await act(async () => {
      pending.get('AAA')!([bar(1000, 10)]);
    });

    expect(result.current.bars.map((b) => b.close)).toEqual([20]);
    expect(result.current.loading).toBe(false);
  });

  it('unmounting mid-flight does not throw or update state after unmount', async () => {
    const adapter = new MockAdapter();
    const { result, unmount } = renderHook(() => useBarsData({ adapter, limit: 5 }));

    let inFlight: Promise<void>;
    act(() => {
      inFlight = result.current.fetchHistorical();
    });
    // Unmount while the 800ms fetch is still pending.
    unmount();

    await expect(inFlight!).resolves.toBeUndefined();
  });
});
