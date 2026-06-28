// Public package entry for @adrienhobbs/candlekit.
// App.tsx / main.tsx remain a dev harness and are intentionally NOT exported.

// Components (all default exports in source → re-exported as named)
export { default as ChartComponent } from './components/ChartComponent';
export type { ContextMenuItem } from './components/ChartComponent';
export { default as IndicatorBrowser } from './components/IndicatorBrowser';
export { default as IndicatorSettingsForm } from './components/IndicatorSettingsForm';
export { default as SettingsDialog } from './components/SettingsDialog';
export { default as LineSettingsDialog } from './components/LineSettingsDialog';

// Types
export type { OHLCVBar, ChartLine, ChartTrade, PriceBand, ChartTheme, IndicatorSettings, IndicatorPanel } from './types/chart';

// Hooks
export { useChartAPI } from './hooks/useChartAPI';
export { useBarsData } from './hooks/useBarsData';
export { useRealtimeUpdates } from './hooks/useRealtimeUpdates';

// Indicator system — this barrel re-exports core/types, core/registry,
// core/calculator, core/persistence (incl. createPersistenceAdapter +
// PersistenceAdapter), the built-in registry, and calculation utils.
export * from './indicators';

// Adapters + bar utils
export { AlpacaBarAdapter } from './adapters/alpaca';
export { MockAdapter } from './adapters/mock';
export type {
  BarDataAdapter,
  BarDataAdapterOptions,
  HistoricalDataParams,
  RealtimeHandlers,
  RealtimeSubscription,
} from './adapters/types';
export * from './utils/barUtils';
