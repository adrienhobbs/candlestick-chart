import { useState, useEffect, useCallback, useRef } from 'react';
import { OHLCVBar } from '../types/chart';

interface RealtimeUpdateConfig {
  enabled: boolean;
  updateIntervalMs: number;
  newBarIntervalMs: number;
}

export function useRealtimeUpdates(
  initialBars: OHLCVBar[],
  config: RealtimeUpdateConfig
) {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const updateIntervalRef = useRef<number>();
  const newBarIntervalRef = useRef<number>();
  const lastBarTimeRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const updateCurrentBar = useCallback((tradePrice: number, tradeVolume: number) => {
    setBars((prev) => {
      if (prev.length === 0) return prev;

      const updated = [...prev];
      const lastBar = { ...updated[updated.length - 1] };

      lastBar.close = tradePrice;
      lastBar.high = Math.max(lastBar.high, tradePrice);
      lastBar.low = Math.min(lastBar.low, tradePrice);
      lastBar.volume += tradeVolume;

      updated[updated.length - 1] = lastBar;
      return updated;
    });
  }, []);

  const addNewBar = useCallback((newBar: OHLCVBar) => {
    setBars((prev) => {
      const exists = prev.find(b => b.timestamp === newBar.timestamp);
      if (exists) return prev;
      return [...prev, newBar];
    });
  }, []);

  const prependBars = useCallback((newBars: OHLCVBar[]) => {
    setBars((prev) => {
      const existingTimestamps = new Set(prev.map(b => b.timestamp));
      const uniqueNewBars = newBars.filter(b => !existingTimestamps.has(b.timestamp));
      return [...uniqueNewBars, ...prev];
    });
  }, []);

  useEffect(() => {
    if (!initializedRef.current && initialBars.length > 0) {
      setBars(initialBars);
      initializedRef.current = true;
    }
  }, [initialBars]);

  useEffect(() => {
    if (!config.enabled || bars.length === 0) return;

    const lastBar = bars[bars.length - 1];
    lastBarTimeRef.current = lastBar.timestamp;

    updateIntervalRef.current = window.setInterval(() => {
      setBars((prev) => {
        if (prev.length === 0) return prev;

        const updated = [...prev];
        const currentBar = { ...updated[updated.length - 1] };

        const newPrice = currentBar.close * (1 + (Math.random() - 0.5) * 0.001);
        const newVolume = Math.floor(Math.random() * 100) + 10;

        currentBar.close = newPrice;
        currentBar.high = Math.max(currentBar.high, newPrice);
        currentBar.low = Math.min(currentBar.low, newPrice);
        currentBar.volume += newVolume;

        updated[updated.length - 1] = currentBar;
        return updated;
      });
    }, config.updateIntervalMs);

    newBarIntervalRef.current = window.setInterval(() => {
      setBars((prev) => {
        if (prev.length === 0) return prev;

        const lastBar = prev[prev.length - 1];
        const newTimestamp = lastBar.timestamp + config.newBarIntervalMs;

        const newPrice = lastBar.close * (1 + (Math.random() - 0.5) * 0.002);

        const newBar: OHLCVBar = {
          timestamp: newTimestamp,
          open: lastBar.close,
          high: newPrice,
          low: Math.min(lastBar.close, newPrice),
          close: newPrice,
          volume: Math.floor(Math.random() * 1000) + 100,
        };

        lastBarTimeRef.current = newTimestamp;
        return [...prev, newBar];
      });
    }, config.newBarIntervalMs);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (newBarIntervalRef.current) {
        clearInterval(newBarIntervalRef.current);
      }
    };
  }, [config.enabled, config.updateIntervalMs, config.newBarIntervalMs, bars.length]);

  return {
    bars,
    updateCurrentBar,
    addNewBar,
    prependBars,
  };
}
