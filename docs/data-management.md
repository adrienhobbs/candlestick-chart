# Data Management Guide

How to get bars into the chart: the `OHLCVBar` contract, the `useBarsData` hook, the
bundled adapters (`AlpacaBarAdapter`, `MockAdapter`), the bar utilities, and how to write
your own adapter. All imports are from `@adrienhobbs/candlekit`.

## Table of Contents

- [Overview](#overview)
- [Understanding the Architecture](#understanding-the-architecture)
- [Quick Start with Alpaca](#quick-start-with-alpaca)
- [Using the useBarsData Hook](#using-the-usebarsdata-hook)
- [Bundled Adapters](#bundled-adapters)
- [Data Utilities](#data-utilities)
- [Integration Recipes](#integration-recipes)
- [Creating Custom Adapters](#creating-custom-adapters)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

`ChartComponent` does not fetch data. It renders the `bars` array you pass and calls
`onLoadMoreData(oldestTimestamp)` when the user scrolls near the left edge. Where the
bars come from is up to you:

- your own state and `fetch` calls,
- the `useBarsData` hook with an adapter (`AlpacaBarAdapter`, `MockAdapter`, or your own
  `BarDataAdapter`),
- any store (Zustand, Redux, React Query) that produces an `OHLCVBar[]`.

### The bar format

```typescript
interface OHLCVBar {
  timestamp: number;     // epoch milliseconds, bar open time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count?: number;
  vwap?: number;
}
```

The chart sorts bars by timestamp and drops duplicate timestamps (keeping the first)
before drawing, but keeping your array sorted and unique avoids surprises in your own
code and in indicator calculations, which receive the array as you passed it.

## Understanding the Architecture

### Data Flow

```
Market data provider → Adapter → useBarsData → bars → ChartComponent
     (Alpaca)          (REST/WS)    (hook)     (state)   (display)
```

### Component Responsibilities

**ChartComponent** (presentation)
- Receives `bars` as a prop and renders candles and volume
- Applies a single-bar `update` when only the last bar changed, a full `setData` otherwise
- Calls `onLoadMoreData` for infinite scroll
- No fetching

**useBarsData** (state)
- Holds the bars array, `loading`, `error` and `connected`
- Validates, normalizes and sorts fetched bars
- Calls the adapter for history and real-time updates

**Adapter** (data source)
- `fetchHistoricalBars` returns bars for a symbol and timeframe
- Optional `subscribeRealtime` streams completed bars and trades
- Converts the provider's format to `OHLCVBar`

## Quick Start with Alpaca

### 1. Get API credentials

Create an account at [Alpaca](https://alpaca.markets/) and generate an API key ID and
secret key (paper trading keys work for market data).

### 2. Configure the environment

For a Vite app:

```bash
VITE_ALPACA_API_KEY=your-api-key-id
VITE_ALPACA_SECRET_KEY=your-secret-key
```

`AlpacaBarAdapter` runs in the browser and sends both keys with every request, so anyone
using the page can read them. That is fine for local tools and demos; for a public site,
put the provider behind your own backend and write a small adapter for it (see
[Creating Custom Adapters](#creating-custom-adapters)).

### 3. Use it

```tsx
import { useMemo } from 'react';
import { AlpacaBarAdapter, ChartComponent, useBarsData } from '@adrienhobbs/candlekit';
import '@adrienhobbs/candlekit/styles.css';

function MyChart() {
  // Create the adapter once; a new instance on every render would re-run the
  // subscription effect each time.
  const adapter = useMemo(
    () =>
      new AlpacaBarAdapter({
        apiKey: import.meta.env.VITE_ALPACA_API_KEY,
        secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
      }),
    [],
  );

  const { bars, loading, error } = useBarsData({
    adapter,
    symbol: 'AAPL',
    timeframe: '5Min',
    autoFetch: true,
  });

  if (loading && bars.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div style={{ height: 600 }}>
      <ChartComponent bars={bars} />
    </div>
  );
}
```

Without a `height` prop the chart fills its container's height, so the container needs
one.

## Using the useBarsData Hook

### API Reference

```typescript
const {
  bars,              // OHLCVBar[]
  loading,           // boolean: a fetchHistorical call is in flight
  error,             // Error | null: last fetch or stream error
  connected,         // boolean: real-time stream connected

  setBars,           // (bars: OHLCVBar[]) => void   validates, normalizes, sorts, replaces
  appendBar,         // (bar: OHLCVBar) => void      appends; ignored if the timestamp exists
  updateLastBar,     // (bar: OHLCVBar) => void      replaces the last bar
  updateCurrentBar,  // (price: number, volume: number) => void   folds a trade into the last bar
  prependBars,       // (bars: OHLCVBar[]) => void   validates, adds older bars in front
  clearBars,         // () => void

  fetchHistorical,   // (params?: Partial<HistoricalDataParams>) => Promise<void>
  subscribe,         // () => void
  unsubscribe,       // () => void
  refetch,           // () => Promise<void>   fetchHistorical() with the hook's options
} = useBarsData(options);
```

`UseBarsDataOptions` and `UseBarsDataReturn` are the type names in the source; they are
not re-exported from the package root, so type the result with
`ReturnType<typeof useBarsData>` if you need it.

### Options

```typescript
interface UseBarsDataOptions {
  adapter?: BarDataAdapter;
  symbol?: string;           // default 'AAPL'
  timeframe?: string;        // default '5Min' (passed through to the adapter)
  autoFetch?: boolean;       // default false: fetch on mount and when symbol/timeframe/limit change
  autoSubscribe?: boolean;   // default false: subscribe while an adapter supports it
  limit?: number;            // default 500
  debug?: boolean;           // default false: log fetch/subscribe traces
}
```

Behavior to know about:

- **`autoFetch` follows the series.** It fetches on mount and again whenever `symbol`,
  `timeframe` or `limit` changes, clearing the old bars first so they never show under
  the new symbol. A new `adapter` object alone does not refetch; call `refetch()`.
- **`fetchHistorical` with `before`** prepends the result to the existing bars, and is
  skipped while another fetch is in flight. Without `before` it replaces the bars and
  supersedes any fetch in flight: a late response for the previous symbol is dropped.
- **Missing adapter.** `fetchHistorical` sets `error` to `No adapter provided`.
- **Real-time handlers.** `onBar` calls `appendBar` and `onTrade` calls
  `updateCurrentBar`. `appendBar` ignores a bar whose timestamp is already present, so an
  adapter must send the forming bar's changes as trades (or you call `updateLastBar`
  yourself), not as repeated `onBar` calls.
- **Subscription lifetime.** With `autoSubscribe`, the hook subscribes when the adapter or
  symbol changes and unsubscribes on cleanup and unmount. Keep the adapter identity stable
  (`useMemo` or module scope).

### Examples

#### Basic usage

```typescript
const { bars, loading } = useBarsData({
  adapter,
  symbol: 'TSLA',
  timeframe: '1Min',
  autoFetch: true,
});
```

#### Switching symbols

```typescript
const [symbol, setSymbol] = useState('AAPL');
const { bars, loading } = useBarsData({ adapter, symbol, timeframe: '5Min', autoFetch: true });
// setSymbol('MSFT') clears the AAPL bars and fetches MSFT.
```

Without `autoFetch`, call `refetch()` in an effect keyed on `symbol` and `timeframe`.

#### Manual live control

```typescript
const { connected, subscribe, unsubscribe } = useBarsData({ adapter, symbol: 'SPY', autoFetch: true });

<button onClick={() => (connected ? unsubscribe() : subscribe())}>
  {connected ? 'Stop live' : 'Go live'}
</button>
```

#### Infinite scroll

```tsx
const { bars, fetchHistorical } = useBarsData({ adapter, symbol: 'AAPL', autoFetch: true });

<ChartComponent
  bars={bars}
  onLoadMoreData={(oldest) => fetchHistorical({ before: oldest, limit: 200 })}
/>
```

#### Error handling

```tsx
const { bars, error, refetch } = useBarsData({ adapter, autoFetch: true });

if (error) {
  return (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={refetch}>Retry</button>
    </div>
  );
}
```

## Bundled Adapters

### AlpacaBarAdapter

```typescript
new AlpacaBarAdapter({
  apiKey: string,       // required
  secretKey: string,    // required (the constructor throws without both)
  baseUrl?: string,     // default 'https://data.alpaca.markets'
  wsUrl?: string,       // default 'wss://stream.data.alpaca.markets/v2/iex'
});
```

- `fetchHistoricalBars` calls `GET {baseUrl}/v2/stocks/{symbol}/bars` with `timeframe`,
  `limit` (default 500) and `feed=iex`; `before` is sent as `end` and `after` as `start`
  (ISO strings). It reads one page and ignores `next_page_token`. `timeframe` uses
  Alpaca's format (`1Min`, `5Min`, `15Min`, `1Hour`, `1Day`).
- `subscribeRealtime(symbol, handlers)` opens the WebSocket, authenticates, and subscribes
  to the symbol's trades (`onTrade`) and minute bars (`onBar`). On close it reconnects up
  to 5 times with exponential backoff starting at 1 s, then reports
  `Max reconnection attempts reached` through `onError`.
- One adapter instance follows one symbol at a time; `unsubscribe()` or `unsubscribeAll()`
  closes the socket.
- The adapter logs connection events to the console.

### MockAdapter

```typescript
const adapter = new MockAdapter();
```

No options. For demos and tests without network access:

- `fetchHistoricalBars` waits 800 ms, then returns `limit` (default 100) random-walk
  5-minute bars ending at `before` (or now). `symbol` and `timeframe` are ignored.
- `subscribeRealtime` calls `onConnect`, then every 5 s calls `onBar` with a random bar
  stamped at the current 5-minute boundary. Through `useBarsData`, only the first bar of
  each 5-minute bucket is appended (see the `appendBar` rule above), and its prices start
  near 100 rather than continuing from the history.

## Data Utilities

All exported from the package root (source: `src/utils/barUtils.ts`). They return new
arrays and never mutate their input.

### Validation

```typescript
import { validateBar, isValidBar } from '@adrienhobbs/candlekit';

validateBar(bar); // type guard: bar is OHLCVBar
isValidBar(bar);  // same check, alias
```

A bar is valid when `timestamp`, `open`, `high`, `low`, `close` and `volume` are numbers,
`timestamp > 0`, all prices are `> 0`, `volume >= 0`, and `high`/`low` bound `open` and
`close`.

### Normalization

```typescript
import { normalizeTimestamp, validateAndNormalizeBars } from '@adrienhobbs/candlekit';

normalizeTimestamp(1700000000);        // 1700000000000: values below 1e10 are treated as seconds
validateAndNormalizeBars(rawBars);     // drops invalid bars (with a console warning), normalizes timestamps
```

`validateAndNormalizeBars` does not sort or dedupe. It also logs the received and returned
counts to the console on every call.

### Deduplication and merging

```typescript
import { deduplicateBars, mergeBars } from '@adrienhobbs/candlekit';

deduplicateBars(bars);                 // unique by timestamp (first wins), sorted
mergeBars(existingBars, newBars);      // concatenate, then deduplicateBars (existing wins)
```

### Sorting and lookup

```typescript
import { sortBars, getOldestBar, getNewestBar } from '@adrienhobbs/candlekit';

sortBars(bars);       // ascending by timestamp
getOldestBar(bars);   // bars[0] or null (assumes sorted)
getNewestBar(bars);   // last bar or null
```

### Bar updates

```typescript
import { appendBar, prependBars, updateBarInArray, updateCurrentBar } from '@adrienhobbs/candlekit';

appendBar(bars, newBar);                       // unchanged if the timestamp exists
prependBars(bars, olderBars);                  // older bars in front, skipping existing timestamps (not re-sorted)
updateBarInArray(bars, bar);                   // replace by timestamp, or insert and sort
updateCurrentBar(bars, tradePrice, tradeSize); // last bar: close = price, extend high/low, add volume
```

## Integration Recipes

### Recipe 1: REST only

```tsx
import { useEffect, useState } from 'react';
import { ChartComponent, prependBars, validateAndNormalizeBars, sortBars, type OHLCVBar } from '@adrienhobbs/candlekit';

function HistoricalChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    fetch('/api/bars?symbol=AAPL&limit=500')
      .then((res) => res.json())
      .then((data) => setBars(sortBars(validateAndNormalizeBars(data))));
  }, []);

  const loadMoreBars = async (oldestTimestamp: number) => {
    const res = await fetch(`/api/bars?symbol=AAPL&before=${oldestTimestamp}&limit=100`);
    const older = sortBars(validateAndNormalizeBars(await res.json()));
    setBars((prev) => prependBars(prev, older));
  };

  return (
    <div style={{ height: 600 }}>
      <ChartComponent bars={bars} onLoadMoreData={loadMoreBars} />
    </div>
  );
}
```

Because `loadMoreBars` is `async`, the chart knows when each load ends. If the server has
no older bars, the chart does not ask again until the view leaves the left edge and
comes back.

### Recipe 2: REST plus a WebSocket of trades

```tsx
import { useEffect, useState } from 'react';
import { ChartComponent, updateCurrentBar, type OHLCVBar } from '@adrienhobbs/candlekit';

function HybridChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;

    fetch('/api/bars?limit=500')
      .then((res) => res.json())
      .then((data: OHLCVBar[]) => {
        if (cancelled) return;
        setBars(data);
        ws = new WebSocket('wss://api.example.com/trades');
        ws.onmessage = (event) => {
          const trade = JSON.parse(event.data) as { price: number; size: number };
          setBars((prev) => updateCurrentBar(prev, trade.price, trade.size));
        };
      });

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  return (
    <div style={{ height: 600 }}>
      <ChartComponent bars={bars} />
    </div>
  );
}
```

This only grows the last bar. To start a new bar when a trade crosses a bar boundary,
compare the trade time with the last bar's timestamp and `appendBar` a fresh bar.

### Recipe 3: Polling

```tsx
import { useEffect, useState } from 'react';
import { ChartComponent, mergeBars, type OHLCVBar } from '@adrienhobbs/candlekit';

function PollingChart() {
  const [bars, setBars] = useState<OHLCVBar[]>([]);

  useEffect(() => {
    const fetchLatest = async () => {
      const res = await fetch('/api/bars/latest');
      const latest: OHLCVBar[] = await res.json();
      // mergeBars keeps the existing bar on a timestamp clash; use updateBarInArray
      // per bar instead if the latest poll should overwrite the forming bar.
      setBars((prev) => mergeBars(prev, latest));
    };
    fetchLatest();
    const interval = setInterval(fetchLatest, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ height: 600 }}>
      <ChartComponent bars={bars} />
    </div>
  );
}
```

### Recipe 4: A global store (Zustand)

If several components need the bars, keep them in a store and pass the array to the
chart. The bar utilities do the array work:

```typescript
// stores/chartStore.ts
import { create } from 'zustand';
import {
  appendBar,
  prependBars,
  sortBars,
  updateCurrentBar,
  validateAndNormalizeBars,
  type BarDataAdapter,
  type OHLCVBar,
  type RealtimeSubscription,
} from '@adrienhobbs/candlekit';

interface ChartState {
  bars: OHLCVBar[];
  loading: boolean;
  error: Error | null;
  subscription: RealtimeSubscription | null;
  load: (adapter: BarDataAdapter, symbol: string, timeframe: string, before?: number) => Promise<void>;
  subscribe: (adapter: BarDataAdapter, symbol: string) => void;
  unsubscribe: () => void;
}

export const useChartStore = create<ChartState>((set, get) => ({
  bars: [],
  loading: false,
  error: null,
  subscription: null,

  load: async (adapter, symbol, timeframe, before) => {
    set({ loading: true, error: null });
    try {
      const data = sortBars(
        validateAndNormalizeBars(await adapter.fetchHistoricalBars({ symbol, timeframe, before, limit: 500 })),
      );
      set({ bars: before ? prependBars(get().bars, data) : data });
    } catch (err) {
      set({ error: err instanceof Error ? err : new Error('Failed to fetch bars') });
    } finally {
      set({ loading: false });
    }
  },

  subscribe: (adapter, symbol) => {
    if (!adapter.subscribeRealtime || get().subscription) return;
    const subscription = adapter.subscribeRealtime(symbol, {
      onBar: (bar) => set({ bars: appendBar(get().bars, bar) }),
      onTrade: (price, volume) => set({ bars: updateCurrentBar(get().bars, price, volume) }),
      onError: (error) => set({ error }),
    });
    set({ subscription });
  },

  unsubscribe: () => {
    get().subscription?.unsubscribe();
    set({ subscription: null });
  },
}));
```

```tsx
import { useEffect } from 'react';
import { ChartComponent, MockAdapter } from '@adrienhobbs/candlekit';
import { useChartStore } from './stores/chartStore';

const adapter = new MockAdapter();

function TradingChart() {
  const bars = useChartStore((s) => s.bars);
  const load = useChartStore((s) => s.load);

  useEffect(() => {
    load(adapter, 'AAPL', '5Min');
  }, [load]);

  return (
    <div style={{ height: 600 }}>
      <ChartComponent bars={bars} onLoadMoreData={(oldest) => load(adapter, 'AAPL', '5Min', oldest)} />
    </div>
  );
}

// Elsewhere: read one value without re-rendering on unrelated changes.
function LastPrice() {
  const last = useChartStore((s) => s.bars[s.bars.length - 1]);
  return last ? <span>{last.close.toFixed(2)}</span> : null;
}
```

### Recipe 5: Full Alpaca integration with useBarsData

```tsx
import { useMemo } from 'react';
import { AlpacaBarAdapter, ChartComponent, useBarsData } from '@adrienhobbs/candlekit';

function AlpacaChart() {
  const adapter = useMemo(
    () =>
      new AlpacaBarAdapter({
        apiKey: import.meta.env.VITE_ALPACA_API_KEY,
        secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
      }),
    [],
  );

  const { bars, loading, error, connected, fetchHistorical, refetch, subscribe, unsubscribe } = useBarsData({
    adapter,
    symbol: 'AAPL',
    timeframe: '5Min',
    autoFetch: true,
  });

  if (loading && bars.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <div className="controls">
        <button onClick={refetch}>Refresh</button>
        <button onClick={() => (connected ? unsubscribe() : subscribe())}>
          {connected ? 'Disconnect' : 'Connect'} live
        </button>
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div style={{ height: 600 }}>
        <ChartComponent bars={bars} onLoadMoreData={(oldest) => fetchHistorical({ before: oldest, limit: 100 })} />
      </div>
    </div>
  );
}
```

## Creating Custom Adapters

Implement `BarDataAdapter` for any provider.

### Adapter Interface

```typescript
interface HistoricalDataParams {
  symbol: string;
  timeframe: string;
  before?: number;   // epoch ms: return bars before this time (older page)
  after?: number;    // epoch ms
  limit?: number;
}

interface RealtimeHandlers {
  onBar?: (bar: OHLCVBar) => void;                    // a new (completed) bar
  onTrade?: (price: number, volume: number) => void;  // a trade inside the forming bar
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface RealtimeSubscription {
  unsubscribe: () => void;
}

interface BarDataAdapter {
  fetchHistoricalBars(params: HistoricalDataParams): Promise<OHLCVBar[]>;
  subscribeRealtime?(symbol: string, handlers: RealtimeHandlers): RealtimeSubscription;
  unsubscribeAll?(): void;
}
```

`BarDataAdapterOptions` (`{ apiKey?, secretKey?, baseUrl?, [key: string]: any }`) is also
exported as a convenient options type.

### Example: your own backend

The usual production setup: the browser talks to your server, which holds the provider
keys.

```typescript
import type { BarDataAdapter, HistoricalDataParams, OHLCVBar } from '@adrienhobbs/candlekit';

export class BackendAdapter implements BarDataAdapter {
  constructor(private baseUrl = '/api') {}

  async fetchHistoricalBars({ symbol, timeframe, before, after, limit = 500 }: HistoricalDataParams): Promise<OHLCVBar[]> {
    const url = new URL(`${this.baseUrl}/bars`, window.location.origin);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('timeframe', timeframe);
    url.searchParams.set('limit', String(limit));
    if (before) url.searchParams.set('before', String(before));
    if (after) url.searchParams.set('after', String(after));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bars request failed: ${res.status}`);
    return (await res.json()) as OHLCVBar[];
  }
}
```

### Example: Polygon.io

```typescript
import type { BarDataAdapter, HistoricalDataParams, OHLCVBar } from '@adrienhobbs/candlekit';

interface PolygonAgg { t: number; o: number; h: number; l: number; c: number; v: number; vw?: number; n?: number }

export class PolygonAdapter implements BarDataAdapter {
  constructor(private apiKey: string) {}

  async fetchHistoricalBars({ symbol, timeframe, before, limit = 500 }: HistoricalDataParams): Promise<OHLCVBar[]> {
    // Map your timeframe strings to Polygon's multiplier/timespan; '5Min' here.
    const [multiplier, timespan] = timeframe === '1Day' ? [1, 'day'] : [5, 'minute'];
    const to = before ?? Date.now();
    const from = to - 30 * 24 * 60 * 60 * 1000;

    const url =
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}` +
      `?sort=desc&limit=${limit}&apiKey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Polygon error: ${res.status}`);
    const data: { results?: PolygonAgg[] } = await res.json();

    return (data.results ?? [])
      .filter((a) => a.t < to)
      .map((a) => ({
        timestamp: a.t,
        open: a.o,
        high: a.h,
        low: a.l,
        close: a.c,
        volume: a.v,
        vwap: a.vw,
        trade_count: a.n,
      }));
  }
}
```

`useBarsData` sorts the result, so returning newest-first is fine.

### Example: real-time support

```typescript
import type { RealtimeHandlers, RealtimeSubscription } from '@adrienhobbs/candlekit';

// inside your adapter class
subscribeRealtime(symbol: string, handlers: RealtimeHandlers): RealtimeSubscription {
  const ws = new WebSocket(`wss://api.example.com/stream?symbol=${symbol}`);
  ws.onopen = () => handlers.onConnect?.();
  ws.onclose = () => handlers.onDisconnect?.();
  ws.onerror = () => handlers.onError?.(new Error('Stream error'));
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'bar') handlers.onBar?.(msg.bar);          // OHLCVBar, epoch ms
    if (msg.type === 'trade') handlers.onTrade?.(msg.price, msg.size);
  };
  return { unsubscribe: () => ws.close() };
}
```

### Mock data

For demos and tests, use the bundled `MockAdapter` (see [MockAdapter](#mockadapter))
rather than writing your own.

## Best Practices

1. **Validate external data.** Run provider data through `validateAndNormalizeBars`;
   `useBarsData` does this for fetched bars and for `setBars`/`prependBars`.
2. **Use epoch milliseconds.** `normalizeTimestamp` converts seconds; ISO strings must be
   converted with `new Date(s).getTime()`.
3. **Keep bars ascending and unique.** `sortBars`, `deduplicateBars` and `mergeBars` do
   this; indicators receive your array as passed.
4. **Create adapters once.** `useMemo` or module scope; a new adapter per render restarts
   subscriptions.
5. **Pass the hook's `bars` straight to the chart.** Do not swap in fallback data while
   loading (see Troubleshooting).
6. **Clean up subscriptions.** `useBarsData` unsubscribes on unmount; if you call
   `adapter.subscribeRealtime` yourself, call `unsubscribe()` in your effect cleanup.
7. **Retry with backoff** on network failures:

```typescript
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
    }
  }
}
```

## Troubleshooting

### No data showing

1. Log `bars.length` and the first bar.
2. Check the chart's container has a height, or pass `height`. Without `height` the chart
   follows the container; if the container measures 0 px tall, the chart starts at
   600 px and stays there.
3. Check timestamps are milliseconds and prices are positive; `validateAndNormalizeBars`
   drops invalid bars with a console warning.
4. Check the network tab and credentials.

### Bars not updating after the initial load

A common cause is substituting fallback data:

```tsx
// Avoid: switching between two different arrays
const displayBars = bars.length > 0 ? bars : fallbackBars;
<ChartComponent bars={displayBars} />

// Prefer: pass the live array
<ChartComponent bars={bars} />
```

The chart diffs each `bars` array against the previous one, and the load-more logic
tracks whether the array grew. Swapping between unrelated arrays confuses both.

### Real-time updates not working

1. Check `connected` and the console (the Alpaca adapter logs connection events).
2. Check the adapter implements `subscribeRealtime`; otherwise `subscribe()` logs a
   warning only when `debug` is on.
3. If the forming bar never changes, the adapter is probably sending it through `onBar`
   repeatedly; `appendBar` ignores repeated timestamps. Send trades through `onTrade`.
4. Markets may be closed.

### Duplicate bars

`deduplicateBars(bars)` or `mergeBars(existing, incoming)` before setting state.

### Wrong times on the axis

Timestamps must be epoch ms. The axis shows the viewer's local time zone unless you pass
`timeZone` (for example `"America/New_York"`) to `ChartComponent`.

### Memory growth over long sessions

Cap the array, for example `setBars((prev) => prev.slice(-5000))` when it gets long.

### API rate limiting (HTTP 429)

Cache responses, page with larger `limit`s, and use a stream instead of polling.

### CORS errors

Call the provider from your backend (see [Example: your own backend](#example-your-own-backend))
or use a proxy.

## Support

- [ChartComponent Usage](./chart-component.md)
- [API Reference](./api-reference.md)
- [Architecture](./architecture.md)
- [GitHub Issues](https://github.com/adrienhobbs/candlestick-chart/issues)
