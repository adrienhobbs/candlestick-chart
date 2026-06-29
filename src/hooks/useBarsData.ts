import { useState, useCallback, useRef, useEffect } from 'react';
import { OHLCVBar } from '../types/chart';
import {
  appendBar as appendBarUtil,
  prependBars as prependBarsUtil,
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
  /** Emit verbose fetch/subscribe traces to the console. Default false. */
  debug?: boolean;
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
    debug = false,
  } = options;

  const [bars, setBarsState] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);

  const subscriptionRef = useRef<RealtimeSubscription | null>(null);
  const isMountedRef = useRef(true);
  const hasInitialFetchRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Debug logging gated behind the `debug` option (read via ref so the loggers
  // keep a stable identity and don't churn the useCallback dep arrays below).
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const log = useCallback((...args: unknown[]) => {
    if (debugRef.current) console.log(...args);
  }, []);
  const warn = useCallback((...args: unknown[]) => {
    if (debugRef.current) console.warn(...args);
  }, []);

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

      if (isFetchingRef.current) {
        log('fetchHistorical: already fetching, skipping');
        return;
      }

      log('fetchHistorical called, params:', params, 'mounted:', isMountedRef.current);
      isFetchingRef.current = true;
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

        log('Calling adapter.fetchHistoricalBars with:', fetchParams);
        const data = await adapter.fetchHistoricalBars(fetchParams);
        log('adapter.fetchHistoricalBars returned, data.length:', data.length);

        if (isMountedRef.current) {
          const validated = validateAndNormalizeBars(data);

          if (params.before) {
            log('Prepending bars (before param present)');
            setBarsState(prev => prependBarsUtil(prev, validated));
          } else {
            log('Setting initial bars (no before param)');
            const sorted = sortBars(validated);
            setBarsState(sorted);
          }
        } else {
          log('Component unmounted, skipping data update');
        }
      } catch (err) {
        if (isMountedRef.current) {
          const error = err instanceof Error ? err : new Error('Failed to fetch historical data');
          setError(error);
          console.error('Failed to fetch historical data:', error);
        }
      } finally {
        isFetchingRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [adapter, symbol, timeframe, limit, log]
  );

  const subscribe = useCallback(() => {
    if (!adapter?.subscribeRealtime) {
      warn('Adapter does not support real-time subscriptions');
      return;
    }

    if (subscriptionRef.current) {
      warn('Already subscribed');
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
  }, [adapter, symbol, appendBar, updateCurrentBar, warn]);

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
    log('useEffect[autoFetch] running, autoFetch:', autoFetch, 'adapter:', !!adapter, 'hasInitialFetch:', hasInitialFetchRef.current);
    if (autoFetch && adapter && !hasInitialFetchRef.current) {
      log('Calling fetchHistorical from useEffect (initial fetch)');
      hasInitialFetchRef.current = true;
      fetchHistorical();
    }
  }, [autoFetch, adapter, fetchHistorical, log]);

  useEffect(() => {
    if (autoSubscribe && adapter?.subscribeRealtime) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [autoSubscribe, adapter, subscribe, unsubscribe]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);

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
