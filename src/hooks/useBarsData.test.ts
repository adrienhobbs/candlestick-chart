import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBarsData } from './useBarsData';
import { MockAdapter } from '../adapters/mock';

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
