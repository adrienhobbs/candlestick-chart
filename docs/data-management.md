# Data Management Guide

A comprehensive guide to fetching, managing, and streaming market data in your trading chart application.

## Table of Contents

- [Overview](#overview)
- [Understanding the Architecture](#understanding-the-architecture)
- [Quick Start with Alpaca](#quick-start-with-alpaca)
- [Using the useBarsData Hook](#using-the-usebarshook)
- [Data Utilities](#data-utilities)
- [Integration Recipes](#integration-recipes)
- [Creating Custom Adapters](#creating-custom-adapters)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The trading chart uses a provider-agnostic data management system that separates data fetching from presentation. This architecture allows you to:

- Use any market data provider (Alpaca, Polygon, IEX, etc.)
- Switch between providers without changing your component code
- Implement custom data sources (databases, files, mock data)
- Handle both historical and real-time data seamlessly

### Key Components

1. **ChartComponent** - Pure presentation component that displays bars
2. **useBarsData Hook** - Manages data state, fetching, and updates
3. **Adapters** - Connect to specific data providers (Alpaca, custom)
4. **Utilities** - Helper functions for validation, normalization, etc.

## Understanding the Architecture

### Data Flow

```
Market Data Provider → Adapter → useBarsData → State → ChartComponent
     (Alpaca)         (API/WS)    (Hook)      (bars)    (Display)
```

### Component Responsibilities

**ChartComponent** (Presentation)
- Receives `bars` array as prop
- Renders candlesticks and volume
- Triggers `onLoadMoreData` for infinite scroll
- No data fetching logic

**useBarsData** (State Management)
- Manages bars state
- Coordinates with adapter
- Provides loading/error states
- Handles subscriptions

**Adapter** (Data Source)
- Fetches historical data
- Subscribes to real-time updates
- Normalizes provider-specific formats
- Handles authentication

## Quick Start with Alpaca

### 1. Get API Credentials

1. Sign up at [Alpaca Markets](https://alpaca.markets/)
2. Navigate to your [Paper Trading Dashboard](https://app.alpaca.markets/paper/dashboard/overview)
3. Go to "Your API Keys"
4. Generate new API keys
5. Copy the API Key ID and Secret Key

### 2. Configure Environment

Add to your `.env` file:

```bash
VITE_ALPACA_API_KEY=your-api-key-id
VITE_ALPACA_SECRET_KEY=your-secret-key
VITE_ALPACA_BASE_URL=https://data.alpaca.markets
VITE_ALPACA_WS_URL=wss://stream.data.alpaca.markets/v2/iex
```

### 3. Use in Your App

```typescript
import { useBarsData } from './hooks/useBarsData';
import { AlpacaBarAdapter } from './adapters/alpaca';
import ChartComponent from './components/ChartComponent';

function MyChart() {
  const adapter = new AlpacaBarAdapter({
    apiKey: import.meta.env.VITE_ALPACA_API_KEY,
    secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
  });

  const { bars, loading, error, connected } = useBarsData({
    adapter,
    symbol: 'AAPL',
    timeframe: '5Min',
    autoFetch: true,
    autoSubscribe: false,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <ChartComponent bars={bars} />;
}
```

That's it! You now have real market data.

## Using the useBarsData Hook

### API Reference

```typescript
const {
  bars,              // OHLCVBar[] - Current bars array
  loading,           // boolean - Loading state
  error,             // Error | null - Error state
  connected,         // boolean - WebSocket connection status

  setBars,           // (bars: OHLCVBar[]) => void
  appendBar,         // (bar: OHLCVBar) => void
  updateLastBar,     // (bar: OHLCVBar) => void
  updateCurrentBar,  // (price: number, volume: number) => void
  prependBars,       // (bars: OHLCVBar[]) => void
  clearBars,         // () => void

  fetchHistorical,   // (params?: Partial<HistoricalDataParams>) => Promise<void>
  subscribe,         // () => void
  unsubscribe,       // () => void
  refetch,           // () => Promise<void>
} = useBarsData(options);
```

### Options

```typescript
interface UseBarsDataOptions {
  adapter?: BarDataAdapter;
  symbol?: string;           // Default: 'AAPL'
  timeframe?: string;        // Default: '5Min'
  autoFetch?: boolean;       // Default: false
  autoSubscribe?: boolean;   // Default: false
  limit?: number;            // Default: 500
}
```

### Examples

#### Basic Usage

```typescript
const { bars, loading } = useBarsData({
  adapter: myAdapter,
  symbol: 'TSLA',
  timeframe: '1Min',
  autoFetch: true,
});
```

#### Manual Control

```typescript
const { bars, fetchHistorical, subscribe, unsubscribe } = useBarsData({
  adapter: myAdapter,
  symbol: 'SPY',
  autoFetch: false,
  autoSubscribe: false,
});

// Fetch when needed
useEffect(() => {
  fetchHistorical();
}, [fetchHistorical]);

// Subscribe to live updates
const handleConnect = () => subscribe();
const handleDisconnect = () => unsubscribe();
```

#### With Error Handling

```typescript
const { bars, error, loading, refetch } = useBarsData({
  adapter: myAdapter,
  autoFetch: true,
});

if (error) {
  return (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={refetch}>Retry</button>
    </div>
  );
}
```

## Data Utilities

Import from `src/utils/barUtils.ts`:

### Validation

```typescript
import { validateBar, isValidBar } from './utils/barUtils';

// Validate a single bar
const isValid = validateBar(bar);

// Type guard
if (isValidBar(bar)) {
  // TypeScript knows bar is OHLCVBar here
}
```

### Normalization

```typescript
import { normalizeTimestamp, validateAndNormalizeBars } from './utils/barUtils';

// Convert seconds to milliseconds
const ms = normalizeTimestamp(timestamp);

// Validate and normalize array
const validBars = validateAndNormalizeBars(rawData);
```

### Deduplication

```typescript
import { deduplicateBars, mergeBars } from './utils/barUtils';

// Remove duplicates
const unique = deduplicateBars(bars);

// Merge two arrays, removing duplicates
const combined = mergeBars(existingBars, newBars);
```

### Sorting

```typescript
import { sortBars } from './utils/barUtils';

// Ensure chronological order
const sorted = sortBars(bars);
```

### Bar Updates

```typescript
import { updateCurrentBar, appendBar, prependBars } from './utils/barUtils';

// Update last bar with trade data
const updated = updateCurrentBar(bars, tradePrice, tradeVolume);

// Add bar to end
const withNew = appendBar(bars, newBar);

// Add bars to beginning
const withOld = prependBars(bars, olderBars);
```

## Integration Recipes

### Recipe 1: REST API Only

Perfect for historical analysis when you don't need real-time updates.

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function HistoricalChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBars = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bars?symbol=AAPL&limit=500');
      const data = await response.json();
      setBars(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBars();
  }, []);

  const loadMoreBars = async (oldestTimestamp: number) => {
    const response = await fetch(
      `/api/bars?symbol=AAPL&before=${oldestTimestamp}&limit=100`
    );
    const olderBars = await response.json();
    setBars(prev => [...olderBars, ...prev]);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <ChartComponent
      bars={bars}
      onLoadMoreData={loadMoreBars}
    />
  );
}
```

### Recipe 2: WebSocket Only

For live trading data with no historical context.

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function LiveChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    const ws = new WebSocket('wss://api.example.com/bars');

    ws.onmessage = (event) => {
      const bar: OHLCVBar = JSON.parse(event.data);
      setBars(prev => [...prev, bar]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => ws.close();
  }, []);

  return <ChartComponent bars={bars} />;
}
```

### Recipe 3: REST + WebSocket (Hybrid)

Load historical data, then stream real-time updates. Best for production.

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';
import { updateCurrentBar } from './utils/barUtils';

function HybridChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Fetch historical data
      const response = await fetch('/api/bars?limit=500');
      const data = await response.json();
      setBars(data);
      setLoading(false);

      // Connect to WebSocket for live updates
      const ws = new WebSocket('wss://api.example.com/trades');

      ws.onmessage = (event) => {
        const trade = JSON.parse(event.data);
        setBars(prev => updateCurrentBar(prev, trade.price, trade.size));
      };

      return () => ws.close();
    };

    const cleanup = init();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return <ChartComponent bars={bars} />;
}
```

### Recipe 4: Polling Strategy

When WebSocket isn't available, poll the API periodically.

```typescript
import { useState, useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { OHLCVBar } from './types/chart';

function PollingChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    const fetchLatest = async () => {
      const response = await fetch('/api/bars/latest');
      const newBars = await response.json();
      setBars(prev => [...prev, ...newBars]);
    };

    // Initial fetch
    fetchLatest();

    // Poll every 5 seconds
    const interval = setInterval(fetchLatest, 5000);

    return () => clearInterval(interval);
  }, []);

  return <ChartComponent bars={bars} />;
}
```

### Recipe 5: Complete Alpaca Integration

Full-featured implementation with all controls.

```typescript
import { useBarsData } from './hooks/useBarsData';
import { AlpacaBarAdapter } from './adapters/alpaca';
import ChartComponent from './components/ChartComponent';

function AlpacaChart() {
  const adapter = new AlpacaBarAdapter({
    apiKey: import.meta.env.VITE_ALPACA_API_KEY,
    secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
  });

  const {
    bars,
    loading,
    error,
    connected,
    fetchHistorical,
    subscribe,
    unsubscribe,
  } = useBarsData({
    adapter,
    symbol: 'AAPL',
    timeframe: '5Min',
    autoFetch: true,
    autoSubscribe: false,
  });

  const handleLoadMore = async (oldestTimestamp: number) => {
    await fetchHistorical({
      before: oldestTimestamp,
      limit: 100,
    });
  };

  if (loading && bars.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <div className="controls">
        <button onClick={() => fetchHistorical()}>
          Refresh
        </button>
        <button onClick={() => connected ? unsubscribe() : subscribe()}>
          {connected ? 'Disconnect' : 'Connect'} Live
        </button>
        <span className="status">
          {connected ? '🟢 Connected' : '⚫ Disconnected'}
        </span>
      </div>
      <ChartComponent
        bars={bars}
        onLoadMoreData={handleLoadMore}
      />
    </div>
  );
}
```

## Creating Custom Adapters

You can create adapters for any market data provider by implementing the `BarDataAdapter` interface.

### Adapter Interface

```typescript
interface BarDataAdapter {
  fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]>;
  subscribeRealtime?(
    symbol: string,
    handlers: RealtimeHandlers
  ): RealtimeSubscription;
  unsubscribeAll?(): void;
}
```

### Example: Polygon.io Adapter

```typescript
import { BarDataAdapter, HistoricalDataParams } from './adapters/types';
import { OHLCVBar } from './types/chart';

export class PolygonAdapter implements BarDataAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, limit = 500 } = params;

    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/minute?limit=${limit}&apiKey=${this.apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.results.map((bar: any) => ({
      timestamp: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
    }));
  }
}
```

### Example: Custom Database Adapter

```typescript
import { BarDataAdapter, HistoricalDataParams } from './adapters/types';
import { OHLCVBar } from './types/chart';

export class DatabaseAdapter implements BarDataAdapter {
  async fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]> {
    const { symbol, before, limit = 500 } = params;

    const query = `
      SELECT * FROM bars
      WHERE symbol = $1
      ${before ? 'AND timestamp < $2' : ''}
      ORDER BY timestamp DESC
      LIMIT $${before ? '3' : '2'}
    `;

    const values = before
      ? [symbol, new Date(before), limit]
      : [symbol, limit];

    const result = await db.query(query, values);

    return result.rows.map(row => ({
      timestamp: row.timestamp.getTime(),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseInt(row.volume),
    }));
  }
}
```

### Example: Mock Data Adapter

```typescript
import { BarDataAdapter, HistoricalDataParams } from './adapters/types';
import { OHLCVBar } from './types/chart';

export class MockAdapter implements BarDataAdapter {
  async fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]> {
    const { limit = 500 } = params;
    const bars: OHLCVBar[] = [];
    const now = Date.now();
    let price = 100;

    for (let i = limit - 1; i >= 0; i--) {
      const timestamp = now - i * 300000; // 5 minutes
      price += (Math.random() - 0.5) * 2;

      const open = price;
      const high = price + Math.random() * 1;
      const low = price - Math.random() * 1;
      const close = low + Math.random() * (high - low);

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
}
```

## Best Practices

### 1. Always Validate Data

```typescript
import { validateAndNormalizeBars } from './utils/barUtils';

const rawData = await fetchFromAPI();
const bars = validateAndNormalizeBars(rawData);
```

### 2. Handle Duplicates

```typescript
import { deduplicateBars } from './utils/barUtils';

setBars(prev => deduplicateBars([...prev, ...newBars]));
```

### 3. Maintain Chronological Order

```typescript
import { sortBars } from './utils/barUtils';

setBars(prev => sortBars([...prev, newBar]));
```

### 4. Normalize Timestamps

Some APIs return seconds, others milliseconds. Always normalize:

```typescript
import { normalizeTimestamp } from './utils/barUtils';

const timestamp = normalizeTimestamp(apiTimestamp);
```

### 5. Implement Error Handling

```typescript
const { bars, error } = useBarsData({ adapter });

if (error) {
  // Show user-friendly error message
  // Offer retry option
  // Log to error tracking service
}
```

### 6. Show Loading States

```typescript
const { bars, loading } = useBarsData({ adapter });

if (loading && bars.length === 0) {
  return <LoadingSpinner />;
}
```

### 7. Cleanup Subscriptions

```typescript
useEffect(() => {
  subscribe();
  return () => unsubscribe();
}, [subscribe, unsubscribe]);
```

### 8. Throttle Updates

Don't update more than once per second for performance:

```typescript
const throttledUpdate = useCallback(
  throttle((bar) => appendBar(bar), 1000),
  []
);
```

### 9. Cache Historical Data

Consider caching to reduce API calls:

```typescript
const cacheKey = `bars_${symbol}_${timeframe}`;
const cached = localStorage.getItem(cacheKey);

if (cached) {
  setBars(JSON.parse(cached));
} else {
  const data = await fetchHistorical();
  localStorage.setItem(cacheKey, JSON.stringify(data));
}
```

### 10. Handle Network Failures

Implement retry logic with exponential backoff:

```typescript
async function fetchWithRetry(fn: () => Promise<any>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

## Troubleshooting

### No Data Showing

**Problem**: Chart is empty

**Solutions**:
1. Check if `bars` array has data: `console.log(bars)`
2. Verify API credentials are correct
3. Check network tab for failed requests
4. Ensure timestamps are in milliseconds
5. Validate bar data format matches `OHLCVBar` interface

### Bars Not Updating After Initial Load

**Problem**: Chart shows initial data but doesn't update when new data arrives

**Common Cause**: Using fallback data that conflicts with adapter data

```typescript
// ❌ BAD - Don't do this
const displayBars = bars.length > 0 ? bars : fallbackBars;
<ChartComponent bars={displayBars} />

// ✅ GOOD - Pass adapter data directly
<ChartComponent bars={bars} />
```

**Why**: If fallback data has more bars than initial adapter data, the chart thinks data was lost (not gained) and won't update. Always pass the adapter's `bars` directly to the chart.

### Real-Time Updates Not Working

**Problem**: WebSocket not receiving data

**Solutions**:
1. Check WebSocket connection status: `console.log(connected)`
2. Verify WebSocket URL is correct
3. Check authentication (some providers require auth)
4. Ensure market is open (for real market data)
5. Check browser console for WebSocket errors

### Duplicate Bars

**Problem**: Same timestamp appears multiple times

**Solutions**:
```typescript
import { deduplicateBars } from './utils/barUtils';

// Before setting state
const unique = deduplicateBars(bars);
setBars(unique);
```

### Wrong Timestamps

**Problem**: Bars showing wrong dates/times

**Solutions**:
```typescript
import { normalizeTimestamp } from './utils/barUtils';

// Convert seconds to milliseconds
const bar = {
  ...rawBar,
  timestamp: normalizeTimestamp(rawBar.timestamp),
};
```

### Memory Leaks

**Problem**: App slows down over time

**Solutions**:
1. Limit bar count: Keep only recent N bars
2. Cleanup subscriptions in `useEffect` return
3. Clear old data periodically

```typescript
// Limit to 5000 bars
if (bars.length > 5000) {
  setBars(bars.slice(-5000));
}
```

### API Rate Limiting

**Problem**: Getting 429 errors

**Solutions**:
1. Implement request caching
2. Add delays between requests
3. Use WebSocket instead of polling
4. Consider upgrading API plan

### CORS Errors

**Problem**: Browser blocks API requests

**Solutions**:
1. Use a proxy server
2. Enable CORS on your API
3. Use Edge Functions (Supabase)
4. Request from backend instead

## Support

For more help:
- [ChartComponent Usage](./chart-component.md)
- [API Reference](./api-reference.md)
- [Architecture](./architecture.md)
- [GitHub Issues](https://github.com/your-repo/issues)
