import { OHLCVBar } from '../types/chart';
import {
  BarDataAdapter,
  HistoricalDataParams,
  RealtimeHandlers,
  RealtimeSubscription,
} from './types';

const STATIC_BARS: OHLCVBar[] = [
  { timestamp: 1760964600000, open: 15.95, high: 15.95, low: 15.91, close: 15.91, volume: 400, trade_count: 4, vwap: 15.9275 },
  { timestamp: 1760964900000, open: 15.86, high: 15.86, low: 15.86, close: 15.86, volume: 100, trade_count: 1, vwap: 15.86 },
  { timestamp: 1760965200000, open: 15.89, high: 15.91, low: 15.89, close: 15.91, volume: 300, trade_count: 3, vwap: 15.896667 },
  { timestamp: 1760967000000, open: 15.67, high: 15.71, low: 15.465, close: 15.515, volume: 15272, trade_count: 108, vwap: 15.548267 },
  { timestamp: 1760967300000, open: 15.55, high: 15.84, low: 15.445, close: 15.64, volume: 16997, trade_count: 130, vwap: 15.65419 },
  { timestamp: 1760967600000, open: 15.62, high: 15.71, low: 15.55, close: 15.64, volume: 14808, trade_count: 87, vwap: 15.640478 },
  { timestamp: 1760967900000, open: 15.65, high: 15.79, low: 15.585, close: 15.66, volume: 22810, trade_count: 111, vwap: 15.703483 },
  { timestamp: 1760968200000, open: 15.67, high: 15.68, low: 15.485, close: 15.53, volume: 15206, trade_count: 170, vwap: 15.544413 },
  { timestamp: 1760968500000, open: 15.54, high: 15.54, low: 15.21, close: 15.22, volume: 22144, trade_count: 198, vwap: 15.328589 },
  { timestamp: 1760968800000, open: 15.215, high: 15.305, low: 15.17, close: 15.215, volume: 22855, trade_count: 226, vwap: 15.26107 },
  { timestamp: 1760969100000, open: 15.22, high: 15.36, low: 15.15, close: 15.36, volume: 12695, trade_count: 114, vwap: 15.241629 },
  { timestamp: 1760969400000, open: 15.355, high: 15.36, low: 15.27, close: 15.31, volume: 10301, trade_count: 90, vwap: 15.29249 },
  { timestamp: 1760969700000, open: 15.275, high: 15.29, low: 15.16, close: 15.24, volume: 11430, trade_count: 98, vwap: 15.211035 },
  { timestamp: 1760970000000, open: 15.255, high: 15.255, low: 15.175, close: 15.25, volume: 5642, trade_count: 85, vwap: 15.218923 },
  { timestamp: 1760970300000, open: 15.235, high: 15.48, low: 15.235, close: 15.47, volume: 11210, trade_count: 125, vwap: 15.360029 },
  { timestamp: 1760970600000, open: 15.47, high: 15.475, low: 15.425, close: 15.445, volume: 14672, trade_count: 118, vwap: 15.456411 },
  { timestamp: 1760970900000, open: 15.47, high: 15.57, low: 15.42, close: 15.565, volume: 13319, trade_count: 127, vwap: 15.493444 },
  { timestamp: 1760971200000, open: 15.575, high: 15.655, low: 15.56, close: 15.615, volume: 11246, trade_count: 106, vwap: 15.607362 },
  { timestamp: 1760971500000, open: 15.615, high: 15.79, low: 15.615, close: 15.79, volume: 9214, trade_count: 93, vwap: 15.70738 },
  { timestamp: 1760971800000, open: 15.815, high: 15.845, low: 15.7, close: 15.835, volume: 18046, trade_count: 97, vwap: 15.744854 },
  { timestamp: 1760972100000, open: 15.825, high: 15.825, low: 15.775, close: 15.8, volume: 7364, trade_count: 95, vwap: 15.791168 },
  { timestamp: 1760972400000, open: 15.81, high: 15.915, low: 15.745, close: 15.91, volume: 8837, trade_count: 113, vwap: 15.845286 },
  { timestamp: 1760972700000, open: 15.925, high: 15.935, low: 15.85, close: 15.85, volume: 9526, trade_count: 83, vwap: 15.895976 },
  { timestamp: 1760973000000, open: 15.865, high: 15.88, low: 15.765, close: 15.79, volume: 11871, trade_count: 85, vwap: 15.845489 },
  { timestamp: 1760973300000, open: 15.79, high: 15.79, low: 15.745, close: 15.79, volume: 7741, trade_count: 59, vwap: 15.775949 },
  { timestamp: 1760973600000, open: 15.78, high: 15.78, low: 15.73, close: 15.735, volume: 3327, trade_count: 41, vwap: 15.753723 },
  { timestamp: 1760973900000, open: 15.745, high: 15.745, low: 15.655, close: 15.735, volume: 4318, trade_count: 55, vwap: 15.721133 },
  { timestamp: 1760974200000, open: 15.73, high: 15.74, low: 15.69, close: 15.69, volume: 3172, trade_count: 41, vwap: 15.713039 },
  { timestamp: 1760974500000, open: 15.73, high: 15.785, low: 15.7, close: 15.75, volume: 7665, trade_count: 65, vwap: 15.737958 },
  { timestamp: 1760974800000, open: 15.75, high: 15.84, low: 15.745, close: 15.84, volume: 6657, trade_count: 57, vwap: 15.781642 },
  { timestamp: 1760975100000, open: 15.79, high: 15.865, low: 15.76, close: 15.865, volume: 4086, trade_count: 32, vwap: 15.793252 },
  { timestamp: 1760975400000, open: 15.89, high: 16.02, low: 15.81, close: 15.84, volume: 17852, trade_count: 108, vwap: 15.922772 },
  { timestamp: 1760975700000, open: 15.88, high: 15.905, low: 15.79, close: 15.88, volume: 6845, trade_count: 52, vwap: 15.850923 },
  { timestamp: 1760976000000, open: 15.865, high: 15.87, low: 15.835, close: 15.85, volume: 7754, trade_count: 57, vwap: 15.856634 },
  { timestamp: 1760976300000, open: 15.89, high: 15.895, low: 15.84, close: 15.84, volume: 4791, trade_count: 67, vwap: 15.868292 },
  { timestamp: 1760976600000, open: 15.83, high: 15.83, low: 15.765, close: 15.815, volume: 5852, trade_count: 50, vwap: 15.793421 },
  { timestamp: 1760976900000, open: 15.765, high: 15.81, low: 15.74, close: 15.81, volume: 6202, trade_count: 69, vwap: 15.784751 },
  { timestamp: 1760977200000, open: 15.835, high: 15.845, low: 15.765, close: 15.77, volume: 4263, trade_count: 43, vwap: 15.80547 },
  { timestamp: 1760977500000, open: 15.75, high: 15.8, low: 15.69, close: 15.69, volume: 5183, trade_count: 56, vwap: 15.753431 },
  { timestamp: 1760977800000, open: 15.73, high: 15.73, low: 15.69, close: 15.725, volume: 4057, trade_count: 38, vwap: 15.708841 },
  { timestamp: 1760978100000, open: 15.735, high: 15.735, low: 15.665, close: 15.69, volume: 2170, trade_count: 30, vwap: 15.700113 },
  { timestamp: 1760978400000, open: 15.73, high: 15.73, low: 15.635, close: 15.635, volume: 4194, trade_count: 46, vwap: 15.665 },
  { timestamp: 1760978700000, open: 15.625, high: 15.66, low: 15.585, close: 15.66, volume: 2005, trade_count: 30, vwap: 15.617257 },
  { timestamp: 1760979000000, open: 15.665, high: 15.72, low: 15.64, close: 15.675, volume: 4582, trade_count: 46, vwap: 15.674563 },
  { timestamp: 1760979300000, open: 15.705, high: 15.825, low: 15.695, close: 15.815, volume: 5413, trade_count: 55, vwap: 15.780466 },
  { timestamp: 1760979600000, open: 15.81, high: 15.84, low: 15.755, close: 15.84, volume: 4828, trade_count: 40, vwap: 15.801818 },
  { timestamp: 1760979900000, open: 15.845, high: 15.92, low: 15.825, close: 15.88, volume: 6520, trade_count: 70, vwap: 15.88929 },
  { timestamp: 1760980200000, open: 15.87, high: 15.885, low: 15.805, close: 15.805, volume: 2112, trade_count: 44, vwap: 15.834519 },
  { timestamp: 1760980500000, open: 15.815, high: 15.815, low: 15.765, close: 15.765, volume: 7140, trade_count: 60, vwap: 15.797748 },
  { timestamp: 1760980800000, open: 15.735, high: 15.76, low: 15.71, close: 15.76, volume: 3074, trade_count: 46, vwap: 15.728363 },
  { timestamp: 1760981100000, open: 15.735, high: 15.765, low: 15.715, close: 15.76, volume: 6076, trade_count: 53, vwap: 15.733527 },
  { timestamp: 1760981400000, open: 15.795, high: 15.795, low: 15.75, close: 15.79, volume: 4154, trade_count: 34, vwap: 15.78103 },
  { timestamp: 1760981700000, open: 15.775, high: 15.82, low: 15.775, close: 15.815, volume: 2585, trade_count: 40, vwap: 15.807534 },
  { timestamp: 1760982000000, open: 15.81, high: 15.815, low: 15.745, close: 15.785, volume: 4114, trade_count: 44, vwap: 15.788205 },
  { timestamp: 1760982300000, open: 15.775, high: 15.83, low: 15.77, close: 15.82, volume: 4261, trade_count: 50, vwap: 15.79609 },
  { timestamp: 1760982600000, open: 15.81, high: 15.82, low: 15.765, close: 15.805, volume: 4771, trade_count: 39, vwap: 15.800061 },
  { timestamp: 1760982900000, open: 15.785, high: 15.825, low: 15.775, close: 15.795, volume: 5714, trade_count: 47, vwap: 15.797628 },
  { timestamp: 1760983200000, open: 15.8, high: 15.825, low: 15.79, close: 15.795, volume: 2475, trade_count: 32, vwap: 15.806088 },
  { timestamp: 1760983500000, open: 15.805, high: 15.805, low: 15.76, close: 15.775, volume: 6426, trade_count: 39, vwap: 15.770791 },
  { timestamp: 1760983800000, open: 15.74, high: 15.74, low: 15.64, close: 15.66, volume: 8173, trade_count: 69, vwap: 15.667161 },
  { timestamp: 1760984100000, open: 15.67, high: 15.67, low: 15.585, close: 15.595, volume: 5930, trade_count: 49, vwap: 15.623152 },
  { timestamp: 1760984400000, open: 15.61, high: 15.71, low: 15.605, close: 15.685, volume: 14601, trade_count: 72, vwap: 15.673252 },
  { timestamp: 1760984700000, open: 15.69, high: 15.69, low: 15.605, close: 15.655, volume: 3547, trade_count: 34, vwap: 15.640761 },
  { timestamp: 1760985000000, open: 15.63, high: 15.795, low: 15.625, close: 15.78, volume: 10654, trade_count: 74, vwap: 15.728531 },
  { timestamp: 1760985300000, open: 15.78, high: 15.96, low: 15.77, close: 15.94, volume: 10214, trade_count: 78, vwap: 15.889394 },
  { timestamp: 1760985600000, open: 15.98, high: 16, low: 15.915, close: 15.915, volume: 10100, trade_count: 63, vwap: 15.959488 },
  { timestamp: 1760985900000, open: 15.9, high: 15.915, low: 15.79, close: 15.915, volume: 10957, trade_count: 76, vwap: 15.871612 },
  { timestamp: 1760986200000, open: 15.95, high: 15.95, low: 15.91, close: 15.94, volume: 9251, trade_count: 68, vwap: 15.932581 },
  { timestamp: 1760986500000, open: 15.935, high: 15.94, low: 15.915, close: 15.93, volume: 6050, trade_count: 48, vwap: 15.935448 },
  { timestamp: 1760986800000, open: 15.96, high: 15.995, low: 15.96, close: 15.975, volume: 3210, trade_count: 36, vwap: 15.978675 },
  { timestamp: 1760987100000, open: 15.985, high: 16.01, low: 15.95, close: 15.99, volume: 5977, trade_count: 45, vwap: 15.965797 },
  { timestamp: 1760987400000, open: 15.985, high: 15.985, low: 15.895, close: 15.95, volume: 7555, trade_count: 57, vwap: 15.932261 },
  { timestamp: 1760987700000, open: 15.91, high: 15.915, low: 15.84, close: 15.87, volume: 8776, trade_count: 72, vwap: 15.887872 },
  { timestamp: 1760988000000, open: 15.87, high: 15.87, low: 15.77, close: 15.8, volume: 11525, trade_count: 76, vwap: 15.794063 },
  { timestamp: 1760988300000, open: 15.82, high: 15.82, low: 15.77, close: 15.805, volume: 9127, trade_count: 69, vwap: 15.782196 },
  { timestamp: 1760988600000, open: 15.82, high: 15.855, low: 15.78, close: 15.855, volume: 9003, trade_count: 65, vwap: 15.814922 },
  { timestamp: 1760988900000, open: 15.86, high: 15.895, low: 15.86, close: 15.895, volume: 17622, trade_count: 99, vwap: 15.873679 },
  { timestamp: 1760989200000, open: 15.895, high: 15.92, low: 15.86, close: 15.865, volume: 10534, trade_count: 80, vwap: 15.897488 },
  { timestamp: 1760989500000, open: 15.87, high: 15.89, low: 15.81, close: 15.875, volume: 16287, trade_count: 80, vwap: 15.859502 },
  { timestamp: 1760989800000, open: 15.88, high: 16.06, low: 15.88, close: 16.03, volume: 16746, trade_count: 82, vwap: 15.971126 },
  { timestamp: 1760990100000, open: 16.035, high: 16.175, low: 16.03, close: 16.135, volume: 73702, trade_count: 301, vwap: 16.125077 },
  { timestamp: 1761049800000, open: 15.86, high: 15.86, low: 15.86, close: 15.86, volume: 100, trade_count: 1, vwap: 15.86 },
  { timestamp: 1761050700000, open: 15.93, high: 15.93, low: 15.93, close: 15.93, volume: 100, trade_count: 1, vwap: 15.93 },
  { timestamp: 1761052200000, open: 15.81, high: 15.81, low: 15.81, close: 15.81, volume: 100, trade_count: 1, vwap: 15.81 },
  { timestamp: 1761052500000, open: 15.78, high: 15.78, low: 15.78, close: 15.78, volume: 100, trade_count: 1, vwap: 15.78 },
  { timestamp: 1761053400000, open: 15.835, high: 15.85, low: 15.64, close: 15.745, volume: 14138, trade_count: 88, vwap: 15.75299 },
  { timestamp: 1761053700000, open: 15.73, high: 16, low: 15.72, close: 15.74, volume: 10416, trade_count: 57, vwap: 15.858252 },
  { timestamp: 1761054000000, open: 15.75, high: 15.87, low: 15.64, close: 15.695, volume: 5161, trade_count: 36, vwap: 15.747909 },
  { timestamp: 1761054300000, open: 15.665, high: 15.74, low: 15.59, close: 15.71, volume: 15230, trade_count: 66, vwap: 15.647249 },
  { timestamp: 1761054600000, open: 15.72, high: 15.79, low: 15.57, close: 15.58, volume: 8089, trade_count: 47, vwap: 15.719162 },
  { timestamp: 1761054900000, open: 15.595, high: 15.6, low: 15.46, close: 15.545, volume: 10297, trade_count: 78, vwap: 15.538196 },
  { timestamp: 1761055200000, open: 15.55, high: 15.645, low: 15.495, close: 15.61, volume: 18660, trade_count: 127, vwap: 15.586895 },
  { timestamp: 1761055500000, open: 15.575, high: 15.76, low: 15.575, close: 15.76, volume: 10160, trade_count: 71, vwap: 15.631528 },
  { timestamp: 1761055800000, open: 15.765, high: 16.04, low: 15.765, close: 16.01, volume: 9621, trade_count: 58, vwap: 15.958984 },
  { timestamp: 1761056100000, open: 16.01, high: 16.2, low: 16.01, close: 16.13, volume: 17361, trade_count: 131, vwap: 16.131882 },
  { timestamp: 1761056400000, open: 16.135, high: 16.19, low: 16.08, close: 16.175, volume: 15850, trade_count: 118, vwap: 16.125815 },
  { timestamp: 1761056700000, open: 16.19, high: 16.19, low: 15.935, close: 15.99, volume: 14371, trade_count: 100, vwap: 16.052782 },
  { timestamp: 1761057000000, open: 15.98, high: 16, low: 15.82, close: 15.85, volume: 17163, trade_count: 101, vwap: 15.945138 },
  { timestamp: 1761057300000, open: 15.84, high: 15.92, low: 15.83, close: 15.885, volume: 6024, trade_count: 69, vwap: 15.89109 },
  { timestamp: 1761057600000, open: 15.915, high: 15.975, low: 15.87, close: 15.89, volume: 9466, trade_count: 77, vwap: 15.905188 },
  { timestamp: 1761057900000, open: 15.93, high: 15.985, low: 15.91, close: 15.935, volume: 9001, trade_count: 66, vwap: 15.943293 },
  { timestamp: 1761058200000, open: 15.955, high: 16.07, low: 15.955, close: 16.055, volume: 2690, trade_count: 24, vwap: 16.015822 },
  { timestamp: 1761058500000, open: 16.045, high: 16.09, low: 15.96, close: 16.07, volume: 5232, trade_count: 49, vwap: 16.033583 },
  { timestamp: 1761058800000, open: 16.095, high: 16.13, low: 16.06, close: 16.06, volume: 9380, trade_count: 63, vwap: 16.097175 },
  { timestamp: 1761059100000, open: 16.065, high: 16.08, low: 15.965, close: 15.975, volume: 5107, trade_count: 53, vwap: 16.047173 },
  { timestamp: 1761059400000, open: 15.945, high: 16, low: 15.945, close: 16, volume: 7336, trade_count: 48, vwap: 15.985071 },
  { timestamp: 1761059700000, open: 16, high: 16.005, low: 15.9, close: 15.95, volume: 9811, trade_count: 67, vwap: 15.938875 },
  { timestamp: 1761060000000, open: 15.945, high: 16.005, low: 15.945, close: 15.98, volume: 4201, trade_count: 43, vwap: 15.984605 },
  { timestamp: 1761060300000, open: 15.99, high: 15.995, low: 15.96, close: 15.96, volume: 4742, trade_count: 60, vwap: 15.979218 },
  { timestamp: 1761060600000, open: 16.005, high: 16.03, low: 16, close: 16, volume: 1399, trade_count: 17, vwap: 16.023496 },
  { timestamp: 1761060900000, open: 16, high: 16.04, low: 15.89, close: 15.96, volume: 7223, trade_count: 71, vwap: 15.952791 },
];

export class MockAdapter implements BarDataAdapter {
  private intervalId: number | null = null;

  async fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]> {
    const { limit = 500, before } = params;

    console.log(`MockAdapter: Returning ${STATIC_BARS.length} static bars, limit: ${limit}, before: ${before}`);
    console.log('First bar:', STATIC_BARS[0]);
    console.log('Last bar:', STATIC_BARS[STATIC_BARS.length - 1]);

    return [...STATIC_BARS];
  }

  subscribeRealtime(symbol: string, handlers: RealtimeHandlers): RealtimeSubscription {
    handlers.onConnect?.();

    let lastPrice = 100;

    this.intervalId = window.setInterval(() => {
      const now = Date.now();
      const timestamp = Math.floor(now / 300000) * 300000;

      const change = (Math.random() - 0.5) * 2;
      lastPrice = Math.max(lastPrice + change, 1);

      const open = lastPrice;
      const close = lastPrice + (Math.random() - 0.5) * 1.5;
      const high = Math.max(open, close) + Math.random() * 0.5;
      const low = Math.min(open, close) - Math.random() * 0.5;

      const bar: OHLCVBar = {
        timestamp,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 10000) + 1000,
      };

      handlers.onBar?.(bar);
      lastPrice = close;
    }, 5000);

    return {
      unsubscribe: () => this.unsubscribeAll(),
    };
  }

  unsubscribeAll(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
