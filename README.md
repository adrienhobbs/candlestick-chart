# Trading Chart Component

A powerful, provider-agnostic trading chart built on TradingView's Lightweight Charts library.

## Features

### Chart Visualization
- Real-time candlestick charts with volume
- Technical indicators (SMA, EMA, RSI, Bollinger Bands, VWAP)
- Interactive price lines for entry/exit levels
- Bar selection and inspection
- Infinite scroll for historical data
- Context menu for quick actions

### Data Management
- Provider-agnostic architecture (works with any data source)
- Built-in Alpaca Markets integration
- Real-time WebSocket support
- Historical data fetching with pagination
- Data validation and normalization utilities
- Error handling and retry logic
- Easy to create custom adapters for other providers

## Quick Start

### Option 1: With Mock Data (No Setup Required)

```bash
npm install
npm run dev
```

The app will run with realistic mock data - perfect for testing and development.

### Option 2: With Real Alpaca Market Data

1. Install dependencies:
```bash
npm install
```

2. Get free Alpaca API credentials (see below)

3. Copy `.env.example` to `.env` and add your credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_ALPACA_API_KEY=your-api-key
VITE_ALPACA_SECRET_KEY=your-secret-key
```

4. Run the development server:
```bash
npm run dev
```

The app will automatically detect your API keys and switch to real market data!

## Getting Alpaca API Credentials

1. Sign up for a free account at [Alpaca Markets](https://alpaca.markets/)
2. Navigate to the [Paper Trading Dashboard](https://app.alpaca.markets/paper/dashboard/overview)
3. Go to "Your API Keys" section
4. Generate new API keys
5. Copy the API Key ID and Secret Key to your `.env` file

## Documentation

See the [docs](./docs) folder for comprehensive documentation:

- [Data Management Guide](./docs/data-management.md) - Complete guide to fetching and managing market data
- [ChartComponent Usage](./docs/chart-component.md) - Complete guide to using the chart
- [Creating Indicators](./docs/creating-indicators.md) - Build custom indicators
- [Architecture](./docs/architecture.md) - System design and architecture
- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Examples](./docs/examples.md) - Code examples and recipes

## Project Structure

```
src/
├── components/          # React components
│   ├── ChartComponent.tsx
│   ├── IndicatorBrowser.tsx
│   └── SettingsDialog.tsx
├── hooks/              # Custom React hooks
│   ├── useBarsData.ts      # Data management hook
│   ├── useChartAPI.ts      # Chart API hook
│   └── useRealtimeUpdates.ts (deprecated)
├── adapters/           # Data provider adapters
│   ├── types.ts
│   └── alpaca.ts
├── indicators/         # Technical indicators
│   ├── core/
│   ├── primitives/
│   ├── registry/
│   └── utils/
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## License

MIT
