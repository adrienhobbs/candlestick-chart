import { OHLCVBar } from '../types/chart';
import {
  BarDataAdapter,
  HistoricalDataParams,
  RealtimeHandlers,
  RealtimeSubscription,
} from './types';

export class MockAdapter implements BarDataAdapter {
  private intervalId: number | null = null;

  async fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]> {
    const { limit = 500, before } = params;
    const bars: OHLCVBar[] = [];
    const now = before || Date.now();
    let price = 100;

    for (let i = limit - 1; i >= 0; i--) {
      const timestamp = now - i * 300000;
      const change = (Math.random() - 0.5) * 2;
      price = Math.max(price + change, 1);

      const open = price;
      const close = price + (Math.random() - 0.5) * 1.5;
      const high = Math.max(open, close) + Math.random() * 0.5;
      const low = Math.min(open, close) - Math.random() * 0.5;

      bars.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 10000) + 1000,
      });

      price = close;
    }

    return bars;
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
