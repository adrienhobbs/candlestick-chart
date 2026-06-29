// Public package entry for @adrienhobbs/candlekit.
// App.tsx / main.tsx remain a dev harness and are intentionally NOT exported.

// Components (all default exports in source → re-exported as named)
export { default as ChartComponent } from './components/ChartComponent';
export type { ContextMenuItem } from './components/ChartComponent';
export { default as IndicatorBrowser } from './components/IndicatorBrowser';
export { default as IndicatorSettingsForm } from './components/IndicatorSettingsForm';
export { default as SettingsDialog } from './components/SettingsDialog';
export { default as LineSettingsDialog } from './components/LineSettingsDialog';
export { default as LineChart } from './components/LineChart';
export type { LineChartSeries, LineChartProps } from './components/LineChart';
export type { OhlcLegendData, OhlcLegendIndicator } from './components/ohlcLegendData';

// Types
export type { OHLCVBar, ChartLine, ChartTrade, PriceBand, ChartTheme, IndicatorPanel } from './types/chart';

// Session shading (config + US-equity preset)
export { US_EQUITY_PRESET } from './sessions/sessions';
export type { SessionsConfig, SessionDef } from './sessions/sessions';
// `IndicatorSettings` is exported via the indicators barrel below (the canonical
// schema type — `Record<string, SettingField>`), so it's intentionally not re-exported here.

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
