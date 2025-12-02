import { OHLCVBar } from '../types/chart';

export interface HistoricalDataParams {
  symbol: string;
  timeframe: string;
  before?: number;
  after?: number;
  limit?: number;
}

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface RealtimeHandlers {
  onBar?: (bar: OHLCVBar) => void;
  onTrade?: (price: number, volume: number) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface BarDataAdapter {
  fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]>;

  subscribeRealtime?(
    symbol: string,
    handlers: RealtimeHandlers
  ): RealtimeSubscription;

  unsubscribeAll?(): void;
}

export interface BarDataAdapterOptions {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  [key: string]: any;
}
