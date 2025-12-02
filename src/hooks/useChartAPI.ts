import { useState, useCallback, useEffect } from 'react';
import { ChartLine } from '../types/chart';
import { IndicatorInstance } from '../indicators/core/types';
import { indicatorRegistry } from '../indicators/core/registry';
import { indicatorCalculator } from '../indicators/core/calculator';
import { PersistenceAdapter } from '../indicators/core/persistence';

interface UseChartAPIOptions {
  persistenceAdapter?: PersistenceAdapter;
}

export function useChartAPI(options?: UseChartAPIOptions) {
  const [lines, setLines] = useState<ChartLine[]>([]);
  const [indicators, setIndicators] = useState<IndicatorInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (options?.persistenceAdapter) {
      options.persistenceAdapter.loadIndicators().then((loaded) => {
        setIndicators(loaded);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [options?.persistenceAdapter]);

  useEffect(() => {
    if (!isLoading && options?.persistenceAdapter) {
      options.persistenceAdapter.saveIndicators(indicators);
    }
  }, [indicators, isLoading, options?.persistenceAdapter]);

  const addLine = useCallback(
    (
      id: string,
      price: number,
      options?: {
        color?: string;
        lineWidth?: number;
        lineStyle?: 'solid' | 'dashed' | 'dotted';
        title?: string;
      }
    ) => {
      const newLine: ChartLine = {
        id,
        price,
        color: options?.color || '#3b82f6',
        lineWidth: options?.lineWidth || 2,
        lineStyle: options?.lineStyle || 'solid',
        title: options?.title,
      };
      setLines((prev) => [...prev, newLine]);
    },
    []
  );

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }, []);

  const updateLine = useCallback((id: string, price: number) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, price } : line))
    );
  }, []);

  const addEntryLine = useCallback(
    (price: number) => {
      const id = `entry-${Date.now()}`;
      addLine(id, price, {
        color: '#3b82f6',
        title: 'Entry',
        lineStyle: 'solid',
      });
    },
    [addLine]
  );

  const addStopLoss = useCallback(
    (price: number) => {
      const id = `stop-loss-${Date.now()}`;
      addLine(id, price, {
        color: '#ef4444',
        title: 'Stop Loss',
        lineStyle: 'dashed',
      });
    },
    [addLine]
  );

  const addTakeProfit = useCallback(
    (price: number) => {
      const id = `take-profit-${Date.now()}`;
      addLine(id, price, {
        color: '#10b981',
        title: 'Take Profit',
        lineStyle: 'dashed',
      });
    },
    [addLine]
  );

  const addLineByType = useCallback(
    (type: 'entry' | 'stopLoss' | 'takeProfit', price: number) => {
      if (type === 'entry') {
        addEntryLine(price);
      } else if (type === 'stopLoss') {
        addStopLoss(price);
      } else if (type === 'takeProfit') {
        addTakeProfit(price);
      }
    },
    [addEntryLine, addStopLoss, addTakeProfit]
  );

  const addIndicator = useCallback((definitionId: string, customSettings?: Record<string, any>) => {
    const instance = indicatorRegistry.createInstance(definitionId, customSettings);
    setIndicators((prev) => [...prev, instance]);
    return instance;
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setIndicators((prev) => prev.filter((indicator) => indicator.id !== id));
    indicatorCalculator.invalidateCache(id);
  }, []);

  const updateIndicatorSettings = useCallback(
    (id: string, settings: Record<string, any>) => {
      setIndicators((prev) =>
        prev.map((indicator) =>
          indicator.id === id ? { ...indicator, settings } : indicator
        )
      );
      indicatorCalculator.invalidateCache(id);
    },
    []
  );

  return {
    lines,
    indicators,
    isLoadingIndicators: isLoading,
    addLine,
    removeLine,
    updateLine,
    addEntryLine,
    addStopLoss,
    addTakeProfit,
    addLineByType,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings,
  };
}
