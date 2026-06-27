export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count?: number;
  vwap?: number;
}

export interface ChartLine {
  id: string;
  price: number;
  color: string;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  title?: string;
  type?: 'entry' | 'stopLoss' | 'takeProfit' | 'mfe' | 'mae';
}

export interface ChartTrade {
  id: string;
  entryTime: number;   // ms timestamp — must equal an entry bar's timestamp
  exitTime: number;    // ms timestamp — must equal an exit bar's timestamp
  entryPrice: number;
  exitPrice: number;
  outcome: 'win' | 'loss';
}

export interface IndicatorSettings {
  [key: string]: any;
}

export interface IndicatorPanel {
  id: string;
  name: string;
  type: 'line' | 'histogram' | 'area';
  settings: IndicatorSettings;
  data: any[];
}
