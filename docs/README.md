# Trading Chart Documentation

This directory contains comprehensive documentation for the trading chart application, including the chart component and modular indicator system.

## Documentation Files

- **[ChartComponent Usage](./chart-component.md)** - Complete guide to using the ChartComponent in your application
- **[Data Management Guide](./data-management.md)** - Comprehensive guide to managing bar data with various providers
- **[Getting Started](./getting-started.md)** - Quick start guide for using the indicator system
- **[Creating Indicators](./creating-indicators.md)** - Step-by-step guide to creating custom indicators
- **[Architecture](./architecture.md)** - Deep dive into the system architecture and design decisions
- **[API Reference](./api-reference.md)** - Complete API documentation for all core components
- **[Examples](./examples.md)** - Example indicator implementations

## Overview

This trading chart application features a powerful, provider-agnostic charting system built on TradingView's Lightweight Charts library. The system consists of two main components:

### ChartComponent

A pure presentation component for displaying candlestick charts with rich interactive features:

- **Candlestick & Volume Charts** - Beautiful OHLCV visualization with automatic color coding
- **Technical Indicators** - Overlay and separate pane indicators
- **Price Lines** - Interactive entry, stop loss, and take profit lines
- **Bar Selection** - Click to inspect individual bars with visual feedback
- **Infinite Scroll** - Load historical data on demand
- **Context Menu** - Right-click to add lines at specific prices
- **Provider Agnostic** - Works with any data source and persistence layer

### Data Management System

A flexible, provider-agnostic system for fetching and managing market data:

- **useBarsData Hook** - Simplifies data fetching, caching, and real-time updates
- **Adapter Pattern** - Standard interface for any market data provider
- **Alpaca Integration** - Production-ready adapter for Alpaca Markets API
- **Utility Functions** - Helpers for validation, deduplication, and normalization
- **Real-time Support** - WebSocket integration for live data streams
- **Error Handling** - Comprehensive error states and retry logic

### Indicator System

A modular, plugin-based architecture for technical indicators:

- **Type-Safe Configuration** - Uses Zod schemas for runtime and compile-time validation
- **Auto-Generated Settings UI** - Automatically creates settings forms from indicator schemas
- **Performance Optimized** - Built-in caching system with automatic cache invalidation
- **Flexible Persistence** - Supports localStorage, Supabase, custom adapters, or no persistence
- **Extensible** - Easy to add new indicators without modifying core code

## Quick Start

### Using the Chart

See [ChartComponent Usage](./chart-component.md) for a complete guide on integrating the chart into your application with your own data sources.

### Managing Market Data

See [Data Management Guide](./data-management.md) for:
- Setting up Alpaca API integration
- Using the `useBarsData` hook
- Creating custom adapters for other providers
- Data management recipes and best practices

### Working with Indicators

1. **Add an indicator to the chart**:
   Click the "Add Indicator" button and select from the available indicators.

2. **Configure indicator settings**:
   Click the settings icon next to any indicator to adjust its parameters, colors, and line styles.

3. **Remove indicators**:
   Click the trash icon next to any indicator to remove it from the chart.

## For Developers

To use the ChartComponent in your app, see [ChartComponent Usage](./chart-component.md).

To create a custom indicator, see [Creating Indicators](./creating-indicators.md).

To understand the system architecture, see [Architecture](./architecture.md).

For API documentation, see [API Reference](./api-reference.md).
