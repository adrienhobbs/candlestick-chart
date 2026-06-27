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

/** A shaded horizontal price band (e.g. an MFE↔MAE excursion zone). */
export interface PriceBand {
  id: string;
  /** Upper price bound of the band. */
  top: number;
  /** Lower price bound of the band. */
  bottom: number;
  /** CSS color (use an rgba/low-opacity fill so candles show through). */
  color: string;
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
