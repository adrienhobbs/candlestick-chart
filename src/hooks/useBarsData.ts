import { useState, useCallback, useRef, useEffect } from 'react';
import { OHLCVBar } from '../types/chart';
import {
  appendBar as appendBarUtil,
  prependBars as prependBarsUtil,
  updateBarInArray,
  deduplicateBars,
  sortBars,
  validateAndNormalizeBars,
  updateCurrentBar as updateCurrentBarUtil,
} from '../utils/barUtils';
import { BarDataAdapter, HistoricalDataParams, RealtimeSubscription } from '../adapters/types';

export interface UseBarsDataOptions {
  adapter?: BarDataAdapter;
  symbol?: string;
  timeframe?: string;
  autoFetch?: boolean;
  autoSubscribe?: boolean;
  limit?: number;
}

export interface UseBarsDataReturn {
  bars: OHLCVBar[];
  loading: boolean;
  error: Error | null;
  connected: boolean;

  setBars: (bars: OHLCVBar[]) => void;
  appendBar: (bar: OHLCVBar) => void;
  updateLastBar: (bar: OHLCVBar) => void;
  updateCurrentBar: (tradePrice: number, tradeVolume: number) => void;
  prependBars: (bars: OHLCVBar[]) => void;
  clearBars: () => void;

  fetchHistorical: (params?: Partial<HistoricalDataParams>) => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;

  refetch: () => Promise<void>;
}

export function useBarsData(options: UseBarsDataOptions = {}): UseBarsDataReturn {
  const {
    adapter,
    symbol = 'AAPL',
    timeframe = '5Min',
    autoFetch = false,
    autoSubscribe = false,
    limit = 500,
  } = options;

  const [bars, setBarsState] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);

  const subscriptionRef = useRef<RealtimeSubscription | null>(null);
  const isMountedRef = useRef(true);

  const setBars = useCallback((newBars: OHLCVBar[]) => {
    const validated = validateAndNormalizeBars(newBars);
    const sorted = sortBars(validated);
    setBarsState(sorted);
  }, []);

  const appendBar = useCallback((bar: OHLCVBar) => {
    setBarsState(prev => appendBarUtil(prev, bar));
  }, []);

  const updateLastBar = useCallback((bar: OHLCVBar) => {
    setBarsState(prev => {
      if (prev.length === 0) return [bar];
      const updated = [...prev];
      updated[updated.length - 1] = bar;
      return updated;
    });
  }, []);

  const updateCurrentBar = useCallback((tradePrice: number, tradeVolume: number) => {
    setBarsState(prev => updateCurrentBarUtil(prev, tradePrice, tradeVolume));
  }, []);

  const prependBars = useCallback((newBars: OHLCVBar[]) => {
    const validated = validateAndNormalizeBars(newBars);
    setBarsState(prev => prependBarsUtil(prev, validated));
  }, []);

  const clearBars = useCallback(() => {
    setBarsState([]);
  }, []);

  const fetchHistorical = useCallback(
    async (params: Partial<HistoricalDataParams> = {}) => {
      if (!adapter) {
        setError(new Error('No adapter provided'));
        return;
      }

      console.log('fetchHistorical called, params:', params);
      console.log('isMountedRef.current:', isMountedRef.current);
      setLoading(true);
      setError(null);

      try {
        const fetchParams: HistoricalDataParams = {
          symbol: params.symbol || symbol,
          timeframe: params.timeframe || timeframe,
          limit: params.limit || limit,
          before: params.before,
          after: params.after,
        };

        console.log('Calling adapter.fetchHistoricalBars with:', fetchParams);
        const data = await adapter.fetchHistoricalBars(fetchParams);
        console.log('adapter.fetchHistoricalBars returned, data.length:', data.length);

        if (isMountedRef.current) {
          console.log('Component still mounted, processing data');
          const validated = validateAndNormalizeBars(data);

          if (params.before) {
            console.log('Prepending bars (before param present)');
            setBarsState(prev => prependBarsUtil(prev, validated));
          } else {
            console.log('Setting initial bars (no before param)');
            const sorted = sortBars(validated);
            setBarsState(sorted);
          }
        } else {
          console.log('Component unmounted, skipping data update');
        }
      } catch (err) {
        console.log('Error caught:', err);
        if (isMountedRef.current) {
          const error = err instanceof Error ? err : new Error('Failed to fetch historical data');
          setError(error);
          console.error('Failed to fetch historical data:', error);
        }
      } finally {
        console.log('Finally block executing, isMountedRef.current:', isMountedRef.current);
        if (isMountedRef.current) {
          console.log('Setting loading to false');
          setLoading(false);
        } else {
          console.log('Skipping setLoading(false) - component unmounted');
        }
      }
    },
    [adapter, symbol, timeframe, limit]
  );

  const subscribe = useCallback(() => {
    if (!adapter?.subscribeRealtime) {
      console.warn('Adapter does not support real-time subscriptions');
      return;
    }

    if (subscriptionRef.current) {
      console.warn('Already subscribed');
      return;
    }

    subscriptionRef.current = adapter.subscribeRealtime(symbol, {
      onBar: (bar) => {
        if (isMountedRef.current) {
          appendBar(bar);
        }
      },
      onTrade: (price, volume) => {
        if (isMountedRef.current) {
          updateCurrentBar(price, volume);
        }
      },
      onError: (err) => {
        if (isMountedRef.current) {
          setError(err);
          setConnected(false);
        }
      },
      onConnect: () => {
        if (isMountedRef.current) {
          setConnected(true);
        }
      },
      onDisconnect: () => {
        if (isMountedRef.current) {
          setConnected(false);
        }
      },
    });
  }, [adapter, symbol, appendBar, updateCurrentBar]);

  const unsubscribe = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      setConnected(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchHistorical();
  }, [fetchHistorical]);

  useEffect(() => {
    console.log('useEffect[autoFetch] running, autoFetch:', autoFetch, 'adapter:', !!adapter);
    if (autoFetch && adapter) {
      console.log('Calling fetchHistorical from useEffect');
      fetchHistorical();
    }
  }, [autoFetch, adapter, fetchHistorical]);

  useEffect(() => {
    if (autoSubscribe && adapter?.subscribeRealtime) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [autoSubscribe, adapter, subscribe, unsubscribe]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    bars,
    loading,
    error,
    connected,
    setBars,
    appendBar,
    updateLastBar,
    updateCurrentBar,
    prependBars,
    clearBars,
    fetchHistorical,
    subscribe,
    unsubscribe,
    refetch,
  };
}
