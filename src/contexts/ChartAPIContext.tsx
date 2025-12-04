import { createContext, useContext, ReactNode } from 'react';
import { useChartAPI } from '../hooks/useChartAPI';
import { PersistenceAdapter } from '../indicators/core/persistence';

type ChartAPIContextType = ReturnType<typeof useChartAPI>;

const ChartAPIContext = createContext<ChartAPIContextType | null>(null);

interface ChartAPIProviderProps {
  children: ReactNode;
  persistenceAdapter?: PersistenceAdapter;
}

export function ChartAPIProvider({ children, persistenceAdapter }: ChartAPIProviderProps) {
  const chartAPI = useChartAPI({ persistenceAdapter });

  return (
    <ChartAPIContext.Provider value={chartAPI}>
      {children}
    </ChartAPIContext.Provider>
  );
}

export function useChartAPIContext() {
  const context = useContext(ChartAPIContext);
  if (!context) {
    throw new Error('useChartAPIContext must be used within ChartAPIProvider');
  }
  return context;
}
