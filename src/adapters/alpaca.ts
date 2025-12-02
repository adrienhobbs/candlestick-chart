import { OHLCVBar } from '../types/chart';
import {
  BarDataAdapter,
  BarDataAdapterOptions,
  HistoricalDataParams,
  RealtimeHandlers,
  RealtimeSubscription,
} from './types';
import { normalizeTimestamp, validateAndNormalizeBars } from '../utils/barUtils';

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n?: number;
  vw?: number;
}

interface AlpacaBarsResponse {
  bars: {
    [symbol: string]: AlpacaBar[];
  };
  next_page_token?: string;
}

interface AlpacaTrade {
  T: string;
  S: string;
  p: number;
  s: number;
  t: string;
}

interface AlpacaBar_WS {
  T: string;
  S: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: string;
  n?: number;
  vw?: number;
}

export class AlpacaBarAdapter implements BarDataAdapter {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentHandlers: RealtimeHandlers | null = null;
  private currentSymbol: string | null = null;
  private authenticated = false;

  constructor(options: BarDataAdapterOptions) {
    if (!options.apiKey || !options.secretKey) {
      throw new Error('Alpaca API key and secret key are required');
    }

    this.apiKey = options.apiKey;
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl || 'https://data.alpaca.markets';
    this.wsUrl = options.wsUrl || 'wss://stream.data.alpaca.markets/v2/iex';
  }

  async fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, before, after, limit = 500 } = params;

    const url = new URL(`${this.baseUrl}/v2/stocks/${symbol}/bars`);
    url.searchParams.set('timeframe', timeframe);
    url.searchParams.set('limit', limit.toString());

    if (before) {
      const beforeDate = new Date(before).toISOString();
      url.searchParams.set('end', beforeDate);
    }

    if (after) {
      const afterDate = new Date(after).toISOString();
      url.searchParams.set('start', afterDate);
    }

    url.searchParams.set('feed', 'iex');

    const headers = {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.secretKey,
    };

    try {
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API error: ${response.status} ${errorText}`);
      }

      const data: AlpacaBarsResponse = await response.json();
      const bars = data.bars[symbol] || [];

      return this.convertAlpacaBars(bars);
    } catch (error) {
      console.error('Failed to fetch Alpaca bars:', error);
      throw error;
    }
  }

  subscribeRealtime(symbol: string, handlers: RealtimeHandlers): RealtimeSubscription {
    this.currentSymbol = symbol;
    this.currentHandlers = handlers;

    this.connectWebSocket();

    return {
      unsubscribe: () => this.disconnect(),
    };
  }

  unsubscribeAll(): void {
    this.disconnect();
  }

  private connectWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('Alpaca WebSocket connected');
        this.authenticated = false;
        this.authenticate();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (event) => {
        console.error('Alpaca WebSocket error:', event);
        this.currentHandlers?.onError?.(new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('Alpaca WebSocket closed');
        this.authenticated = false;
        this.currentHandlers?.onDisconnect?.();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.currentHandlers?.onError?.(
        error instanceof Error ? error : new Error('Failed to create WebSocket')
      );
    }
  }

  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const authMessage = {
      action: 'auth',
      key: this.apiKey,
      secret: this.secretKey,
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.currentSymbol) return;

    const subscribeMessage = {
      action: 'subscribe',
      trades: [this.currentSymbol],
      bars: [this.currentSymbol],
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`Subscribed to ${this.currentSymbol}`);
  }

  private handleMessage(data: string): void {
    try {
      const messages = JSON.parse(data);

      if (!Array.isArray(messages)) {
        console.warn('Unexpected message format:', messages);
        return;
      }

      for (const message of messages) {
        if (message.T === 'success' && message.msg === 'authenticated') {
          console.log('Alpaca WebSocket authenticated');
          this.authenticated = true;
          this.reconnectAttempts = 0;
          this.currentHandlers?.onConnect?.();
          this.subscribe();
        } else if (message.T === 'error') {
          console.error('Alpaca error:', message.msg);
          this.currentHandlers?.onError?.(new Error(message.msg));
        } else if (message.T === 't') {
          this.handleTrade(message as AlpacaTrade);
        } else if (message.T === 'b') {
          this.handleBar(message as AlpacaBar_WS);
        } else if (message.T === 'subscription') {
          console.log('Subscription confirmed:', message);
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleTrade(trade: AlpacaTrade): void {
    if (trade.S !== this.currentSymbol) return;

    this.currentHandlers?.onTrade?.(trade.p, trade.s);
  }

  private handleBar(bar: AlpacaBar_WS): void {
    if (bar.S !== this.currentSymbol) return;

    const ohlcvBar: OHLCVBar = {
      timestamp: new Date(bar.t).getTime(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      trade_count: bar.n,
      vwap: bar.vw,
    };

    this.currentHandlers?.onBar?.(ohlcvBar);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.currentHandlers?.onError?.(new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.currentSymbol && this.currentHandlers) {
        this.connectWebSocket();
      }
    }, delay);
  }

  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
    this.currentSymbol = null;
    this.currentHandlers = null;
    this.reconnectAttempts = 0;
  }

  private convertAlpacaBars(bars: AlpacaBar[]): OHLCVBar[] {
    return bars.map(bar => ({
      timestamp: new Date(bar.t).getTime(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      trade_count: bar.n,
      vwap: bar.vw,
    }));
  }
}
