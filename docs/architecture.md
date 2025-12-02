# Indicator System Architecture

This document explains the architecture and design decisions behind the modular indicator system.

## Overview

The indicator system follows a plugin-based architecture where indicators are self-contained modules that can be added without modifying core code. The system consists of several key components working together:

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  (IndicatorBrowser, SettingsDialog, ChartComponent)         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Application Layer                         │
│              (useChartAPI, App Component)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                      Core System                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Registry   │  │  Calculator  │  │ Persistence  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   Indicator Definitions                      │
│         (SMA, EMA, RSI, Bollinger, Custom...)               │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Type System (`src/indicators/core/types.ts`)

The foundation of the system uses Zod schemas for type-safe configuration:

```typescript
// Indicator metadata
interface IndicatorMetadata {
  id: string;              // Unique identifier
  name: string;            // Display name
  description: string;     // User-facing description
  category: IndicatorCategory;  // TREND, MOMENTUM, etc.
  version: string;         // Version number
}

// Settings schema
interface SettingField {
  type: 'number' | 'color' | 'boolean' | 'select' | 'lineStyle';
  label: string;
  defaultValue: any;
  description?: string;
  min?: number;           // For numbers
  max?: number;           // For numbers
  step?: number;          // For numbers
  options?: Array<{label: string, value: string}>;  // For select
}

// Complete indicator definition
interface IndicatorDefinition {
  metadata: IndicatorMetadata;
  settings: Record<string, SettingField>;
  renderConfig: RenderConfig;
  calculate: IndicatorCalculation;
}

// Runtime instance
interface IndicatorInstance {
  id: string;              // Instance ID (e.g., 'sma-1')
  definitionId: string;    // Definition ID (e.g., 'sma')
  name: string;            // Instance name (e.g., 'SMA(1)')
  settings: Record<string, any>;
  data?: IndicatorOutput[];
}
```

**Design Decision**: Using Zod provides both compile-time TypeScript types and runtime validation, ensuring type safety throughout the application.

### 2. Indicator Registry (`src/indicators/core/registry.ts`)

Centralized registry for managing indicator definitions and creating instances:

```typescript
class IndicatorRegistry {
  // Register new indicators
  register(definition: IndicatorDefinition): void

  // Retrieve indicators
  get(id: string): IndicatorDefinition | undefined
  getAll(): IndicatorDefinition[]
  getByCategory(category: IndicatorCategory): IndicatorDefinition[]
  search(query: string): IndicatorDefinition[]

  // Create instances with auto-naming
  createInstance(definitionId: string, customSettings?: Record<string, any>): IndicatorInstance

  // Validate settings
  validateSettings(definitionId: string, settings: Record<string, any>): boolean
}
```

**Design Decision**: The registry pattern provides a single source of truth for all indicator definitions and handles instance creation with automatic naming (sma-1, sma-2, etc.).

### 3. Calculator (`src/indicators/core/calculator.ts`)

Handles indicator calculation with caching:

```typescript
class IndicatorCalculator {
  // Calculate indicator values with caching
  calculate(instance: IndicatorInstance, bars: OHLCVBar[]): IndicatorOutput[]

  // Cache management
  invalidateCache(instanceId?: string): void
  getCacheSize(): number
}
```

**Caching Strategy**:
- Cache key: `instanceId`
- Cache validity: Checked against settings hash and data length
- Invalidation: Automatic on settings changes, manual on data updates
- Storage: In-memory Map for fast access

**Design Decision**: Caching prevents redundant calculations when rendering, significantly improving performance with multiple indicators.

### 4. Persistence Layer (`src/indicators/core/persistence.ts`)

Abstracted persistence with multiple adapters:

```typescript
interface PersistenceAdapter {
  saveIndicators(indicators: IndicatorInstance[]): Promise<void>
  loadIndicators(): Promise<IndicatorInstance[]>
  deleteIndicator(id: string): Promise<void>
}

// Available adapters
class SupabasePersistenceAdapter implements PersistenceAdapter { }
class LocalStoragePersistenceAdapter implements PersistenceAdapter { }
class NoOpPersistenceAdapter implements PersistenceAdapter { }
```

**Design Decision**: The adapter pattern allows developers to:
- Use Supabase for cloud sync (default)
- Use localStorage for local-only persistence
- Use NoOp to disable persistence entirely
- Implement custom adapters for other backends

### 5. Auto-Generated Forms (`src/components/IndicatorSettingsForm.tsx`)

Settings forms are generated from Zod schemas:

```typescript
function renderField(key: string, field: SettingField, value: any, onChange: Function) {
  switch (field.type) {
    case 'number':  return <NumberInput {...field} />
    case 'color':   return <ColorPicker {...field} />
    case 'boolean': return <Checkbox {...field} />
    case 'select':  return <Select {...field} />
    case 'lineStyle': return <LineStyleSelect {...field} />
  }
}
```

**Design Decision**: Auto-generation eliminates boilerplate UI code and ensures settings UI always matches the schema.

## Data Flow

### Adding an Indicator

```
User clicks "Add Indicator"
  → IndicatorBrowser displays all registered indicators
  → User selects indicator
  → Registry.createInstance(definitionId)
  → Instance created with default settings and unique ID
  → useChartAPI adds to indicators array
  → PersistenceAdapter saves to storage
  → ChartComponent calculates and renders
```

### Updating Settings

```
User clicks settings icon
  → SettingsDialog opens with current settings
  → Form auto-generated from definition schema
  → User modifies settings
  → Validation against schema
  → useChartAPI.updateIndicatorSettings()
  → Calculator.invalidateCache(instanceId)
  → PersistenceAdapter saves changes
  → ChartComponent recalculates and re-renders
```

### Loading from Persistence

```
App initializes
  → useChartAPI calls persistenceAdapter.loadIndicators()
  → Indicators loaded from Supabase/localStorage
  → State initialized with loaded indicators
  → ChartComponent calculates and renders all indicators
```

## Directory Structure

```
src/indicators/
├── core/                      # Core system components
│   ├── types.ts              # Type definitions and Zod schemas
│   ├── registry.ts           # Indicator registry
│   ├── calculator.ts         # Calculation engine with caching
│   └── persistence.ts        # Persistence adapters
├── registry/                  # Indicator definitions
│   ├── index.ts              # Registration function
│   ├── sma.ts                # Simple Moving Average
│   ├── ema.ts                # Exponential Moving Average
│   ├── rsi.ts                # Relative Strength Index
│   ├── bollinger.ts          # Bollinger Bands
│   └── [custom].ts           # Your custom indicators
├── calculations/              # Calculation utilities
│   └── calculations.ts        # Reusable calculation functions
├── utils/                     # Helper utilities
└── index.ts                   # Main export file
```

## Design Principles

### 1. Separation of Concerns
Each component has a single responsibility:
- Registry: Manage definitions and create instances
- Calculator: Compute indicator values
- Persistence: Store and retrieve indicators
- UI Components: Display and interact with indicators

### 2. Immutability
Indicator instances are treated as immutable:
- Settings updates create new instances
- Calculations never modify source data
- State updates use functional patterns

### 3. Type Safety
Strong typing throughout:
- Zod schemas for runtime validation
- TypeScript interfaces for compile-time safety
- Generic types for flexible implementations

### 4. Extensibility
Easy to extend without modification:
- Add indicators by creating new definitions
- Add persistence layers by implementing adapter interface
- Add setting types by extending form renderer

### 5. Performance
Optimized for real-time charts:
- Calculation results cached
- React hooks prevent unnecessary re-renders
- Efficient data structures (Maps for O(1) lookups)

## Integration Points

### Chart Component Integration

The ChartComponent consumes indicators and handles rendering:

```typescript
indicators.forEach((indicator) => {
  const definition = indicatorRegistry.get(indicator.definitionId);
  const data = indicatorCalculator.calculate(indicator, bars);

  // Create appropriate series based on renderConfig
  if (definition.renderConfig.seriesType === 'line') {
    const series = chart.addSeries(LineSeries, {
      color: indicator.settings.color,
      lineWidth: indicator.settings.lineWidth,
    });
    series.setData(data);
  }
});
```

### Hook Integration

The `useChartAPI` hook provides a clean API for managing indicators:

```typescript
const {
  indicators,              // Current indicators
  addIndicator,           // Add new indicator
  removeIndicator,        // Remove indicator
  updateIndicatorSettings, // Update settings
} = useChartAPI({ persistenceAdapter });
```

## Security Considerations

### RLS Policies
Supabase table has Row Level Security enabled:
- Users can only access their own indicators
- Authentication required for all operations
- Policies enforce user_id matching

### Data Validation
- Settings validated against Zod schema before saving
- Invalid configurations rejected at runtime
- Type safety prevents common errors

## Performance Characteristics

### Time Complexity
- Registry lookup: O(1)
- Cache lookup: O(1)
- Calculation: O(n) where n = number of bars
- Persistence save: O(m) where m = number of indicators

### Space Complexity
- Cache storage: O(i * d) where i = indicators, d = data points
- Memory footprint: Minimal, only calculated data cached

### Optimization Opportunities
- Implement Web Workers for heavy calculations
- Add progressive calculation for large datasets
- Implement virtual scrolling for indicator list

## Testing Strategy

### Unit Tests
- Test calculation functions with known inputs/outputs
- Test registry CRUD operations
- Test cache invalidation logic

### Integration Tests
- Test indicator creation and rendering
- Test persistence save/load cycles
- Test settings updates and recalculation

### E2E Tests
- Test complete user workflows
- Test browser compatibility
- Test performance under load

## Future Enhancements

Potential improvements to consider:

1. **Custom Indicator UI**: Allow indicators to provide custom React components
2. **Indicator Templates**: Save and share indicator configurations
3. **Composite Indicators**: Create indicators that combine multiple indicators
4. **Real-time Collaboration**: Sync indicators across multiple users
5. **Indicator Marketplace**: Community-contributed indicators
6. **Performance Monitoring**: Track calculation times and optimize
7. **Chart Templates**: Save entire chart configurations with indicators

## Conclusion

The indicator system provides a robust, extensible foundation for technical analysis. Its modular architecture makes it easy to add new indicators while maintaining type safety and performance.
