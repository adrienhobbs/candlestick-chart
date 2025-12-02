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
  type?: 'entry' | 'stopLoss' | 'takeProfit';
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
