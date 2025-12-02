# API Reference

Complete API documentation for the indicator system.

## Core API

### IndicatorRegistry

Singleton instance: `indicatorRegistry`

#### Methods

##### `register(definition: IndicatorDefinition): void`
Registers a new indicator definition.

```typescript
import { indicatorRegistry } from './indicators';

indicatorRegistry.register(MyCustomIndicator);
```

##### `get(id: string): IndicatorDefinition | undefined`
Retrieves an indicator definition by ID.

```typescript
const definition = indicatorRegistry.get('sma');
```

##### `getAll(): IndicatorDefinition[]`
Returns all registered indicator definitions.

```typescript
const allIndicators = indicatorRegistry.getAll();
```

##### `getByCategory(category: IndicatorCategory): IndicatorDefinition[]`
Returns all indicators in a specific category.

```typescript
import { IndicatorCategory } from './indicators';

const trendIndicators = indicatorRegistry.getByCategory(IndicatorCategory.TREND);
```

##### `search(query: string): IndicatorDefinition[]`
Searches indicators by name or description.

```typescript
const results = indicatorRegistry.search('moving average');
```

##### `createInstance(definitionId: string, customSettings?: Record<string, any>): IndicatorInstance`
Creates a new instance of an indicator with auto-generated ID and name.

```typescript
const instance = indicatorRegistry.createInstance('sma', { period: 50 });
// instance.id = 'sma-1'
// instance.name = 'SMA(1)'
```

##### `validateSettings(definitionId: string, settings: Record<string, any>): boolean`
Validates settings against the indicator's schema.

```typescript
const isValid = indicatorRegistry.validateSettings('sma', {
  period: 20,
  color: '#3b82f6',
  lineWidth: 2,
});
```

---

### IndicatorCalculator

Singleton instance: `indicatorCalculator`

#### Methods

##### `calculate(instance: IndicatorInstance, bars: OHLCVBar[]): IndicatorOutput[]`
Calculates indicator values with automatic caching.

```typescript
import { indicatorCalculator } from './indicators';

const data = indicatorCalculator.calculate(indicatorInstance, bars);
```

##### `invalidateCache(instanceId?: string): void`
Invalidates cached calculation results.

```typescript
// Invalidate specific indicator
indicatorCalculator.invalidateCache('sma-1');

// Invalidate all indicators
indicatorCalculator.invalidateCache();
```

##### `getCacheSize(): number`
Returns the number of cached indicator calculations.

```typescript
const size = indicatorCalculator.getCacheSize();
```

---

### Persistence Adapters

#### Factory Function

##### `createPersistenceAdapter(type, options?): PersistenceAdapter`
Creates a persistence adapter of the specified type.

```typescript
import { createPersistenceAdapter } from './indicators';

// Supabase adapter
const adapter = createPersistenceAdapter('supabase', {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-anon-key',
});

// localStorage adapter
const localAdapter = createPersistenceAdapter('localStorage');

// No-op adapter (disabled)
const noopAdapter = createPersistenceAdapter('none');
```

#### PersistenceAdapter Interface

```typescript
interface PersistenceAdapter {
  saveIndicators(indicators: IndicatorInstance[]): Promise<void>;
  loadIndicators(): Promise<IndicatorInstance[]>;
  deleteIndicator(id: string): Promise<void>;
}
```

##### `saveIndicators(indicators: IndicatorInstance[]): Promise<void>`
Saves all indicator instances to storage.

```typescript
await adapter.saveIndicators(indicators);
```

##### `loadIndicators(): Promise<IndicatorInstance[]>`
Loads all indicator instances from storage.

```typescript
const indicators = await adapter.loadIndicators();
```

##### `deleteIndicator(id: string): Promise<void>`
Deletes a specific indicator from storage.

```typescript
await adapter.deleteIndicator('sma-1');
```

---

## React Hooks

### useChartAPI

Main hook for managing indicators and chart features.

#### Parameters

```typescript
interface UseChartAPIOptions {
  persistenceAdapter?: PersistenceAdapter;
}
```

#### Returns

```typescript
interface UseChartAPIReturn {
  // Indicator management
  indicators: IndicatorInstance[];
  isLoadingIndicators: boolean;
  addIndicator: (definitionId: string, customSettings?: Record<string, any>) => IndicatorInstance;
  removeIndicator: (id: string) => void;
  updateIndicatorSettings: (id: string, settings: Record<string, any>) => void;

  // Line management
  lines: ChartLine[];
  addLine: (id: string, price: number, options?: LineOptions) => void;
  removeLine: (id: string) => void;
  updateLine: (id: string, price: number) => void;
  addEntryLine: (price: number) => void;
  addStopLoss: (price: number) => void;
  addTakeProfit: (price: number) => void;
  addLineByType: (type: 'entry' | 'stopLoss' | 'takeProfit', price: number) => void;
}
```

#### Usage

```typescript
import { useChartAPI } from './hooks/useChartAPI';
import { createPersistenceAdapter } from './indicators';

function MyComponent() {
  const adapter = createPersistenceAdapter('localStorage');

  const {
    indicators,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings,
  } = useChartAPI({ persistenceAdapter: adapter });

  const handleAddSMA = () => {
    addIndicator('sma', { period: 20 });
  };

  const handleUpdateSettings = (id: string) => {
    updateIndicatorSettings(id, { period: 50, color: '#ff0000' });
  };

  return (
    // Your JSX
  );
}
```

---

## React Components

### IndicatorBrowser

Modal component for browsing and adding indicators.

#### Props

```typescript
interface IndicatorBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIndicator: (definitionId: string) => void;
}
```

#### Usage

```typescript
<IndicatorBrowser
  isOpen={isBrowserOpen}
  onClose={() => setIsBrowserOpen(false)}
  onAddIndicator={(id) => addIndicator(id)}
/>
```

---

### SettingsDialog

Modal component for editing indicator settings.

#### Props

```typescript
interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  indicator: IndicatorInstance | null;
  onSave: (indicatorId: string, settings: Record<string, any>) => void;
}
```

#### Usage

```typescript
<SettingsDialog
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  indicator={selectedIndicator}
  onSave={(id, settings) => updateIndicatorSettings(id, settings)}
/>
```

---

### IndicatorSettingsForm

Auto-generated form component for indicator settings.

#### Props

```typescript
interface IndicatorSettingsFormProps {
  settings: IndicatorSettings;
  currentValues: Record<string, any>;
  onChange: (key: string, value: any) => void;
}
```

#### Usage

```typescript
<IndicatorSettingsForm
  settings={definition.settings}
  currentValues={indicator.settings}
  onChange={(key, value) => handleChange(key, value)}
/>
```

---

### ChartComponent

Main chart component with indicator rendering support.

#### Props

```typescript
interface ChartComponentProps {
  bars: OHLCVBar[];
  onLoadMoreData?: (oldestTimestamp: number) => void;
  indicators?: IndicatorInstance[];
  lines?: ChartLine[];
  onBarUpdate?: (updatedBar: OHLCVBar) => void;
  onNewBar?: (newBar: OHLCVBar) => void;
  onDeleteLine?: (lineId: string) => void;
  onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit', price: number) => void;
}
```

#### Usage

```typescript
<ChartComponent
  bars={bars}
  indicators={indicators}
  lines={lines}
  onLoadMoreData={handleLoadMore}
  onDeleteLine={removeLine}
  onAddLine={addLineByType}
/>
```

---

## Type Definitions

### IndicatorCategory

```typescript
enum IndicatorCategory {
  TREND = 'Trend',
  MOMENTUM = 'Momentum',
  VOLATILITY = 'Volatility',
  VOLUME = 'Volume',
  OSCILLATORS = 'Oscillators',
}
```

### ChartSeriesType

```typescript
enum ChartSeriesType {
  LINE = 'line',
  HISTOGRAM = 'histogram',
  AREA = 'area',
}
```

### SettingFieldType

```typescript
type SettingFieldType = 'number' | 'color' | 'boolean' | 'select' | 'lineStyle';
```

### IndicatorDefinition

```typescript
interface IndicatorDefinition {
  metadata: IndicatorMetadata;
  settings: Record<string, SettingField>;
  renderConfig: RenderConfig;
  calculate: IndicatorCalculation;
}
```

### IndicatorInstance

```typescript
interface IndicatorInstance {
  id: string;
  definitionId: string;
  name: string;
  settings: Record<string, any>;
  data?: IndicatorOutput[];
}
```

### IndicatorOutput

```typescript
interface IndicatorOutput {
  time: number;
  value: number;
  [key: string]: number;  // For multi-line indicators
}
```

### SettingField

```typescript
interface SettingField {
  type: SettingFieldType;
  label: string;
  defaultValue: string | number | boolean;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}
```

---

## Utility Functions

### Calculation Utilities (`src/indicators/utils/calculations.ts`)

#### `calculateSMA(bars: OHLCVBar[], period: number): number[]`
Calculates Simple Moving Average.

```typescript
import { calculateSMA } from './indicators/utils/calculations';

const sma = calculateSMA(bars, 20);
```

#### `calculateEMA(bars: OHLCVBar[], period: number): number[]`
Calculates Exponential Moving Average.

```typescript
import { calculateEMA } from './indicators/utils/calculations';

const ema = calculateEMA(bars, 12);
```

#### `calculateRSI(bars: OHLCVBar[], period: number): number[]`
Calculates Relative Strength Index.

```typescript
import { calculateRSI } from './indicators/utils/calculations';

const rsi = calculateRSI(bars, 14);
```

#### `calculateBollingerBands(bars: OHLCVBar[], period: number, stdDev: number)`
Calculates Bollinger Bands.

```typescript
import { calculateBollingerBands } from './indicators/utils/calculations';

const { upper, middle, lower } = calculateBollingerBands(bars, 20, 2);
```

#### `calculateStandardDeviation(values: number[], period: number): number[]`
Calculates rolling standard deviation.

```typescript
import { calculateStandardDeviation } from './indicators/utils/calculations';

const closes = bars.map(b => b.close);
const stdDev = calculateStandardDeviation(closes, 20);
```

---

## Constants

### Default Colors

Common color values used in built-in indicators:

```typescript
const COLORS = {
  BLUE: '#3b82f6',
  GREEN: '#10b981',
  RED: '#ef4444',
  PURPLE: '#8b5cf6',
  ORANGE: '#f59e0b',
  TEAL: '#14b8a6',
};
```

### Default Settings

```typescript
const DEFAULT_PERIOD = 14;
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_LINE_STYLE = 'solid';
```

---

## Error Handling

### Common Errors

#### Indicator Not Found
```typescript
const definition = indicatorRegistry.get('nonexistent');
// Returns: undefined
```

#### Invalid Settings
```typescript
const isValid = indicatorRegistry.validateSettings('sma', {
  period: 'invalid',  // Should be number
});
// Returns: false
```

#### Calculation Errors
```typescript
try {
  const data = indicatorCalculator.calculate(instance, bars);
} catch (error) {
  console.error('Calculation error:', error);
  // Returns: empty array []
}
```

---

## Best Practices

1. **Always validate settings** before saving
2. **Invalidate cache** when settings change
3. **Handle async operations** with try-catch
4. **Check for undefined** when getting registry items
5. **Filter NaN values** from calculation results
6. **Use TypeScript types** for compile-time safety

---

## Migration Guide

### From Old System to New System

If migrating from the old `IndicatorPanel` system:

#### Old Code
```typescript
const panel: IndicatorPanel = {
  id: 'sma-20',
  name: 'SMA(20)',
  type: 'line',
  settings: { period: 20, color: '#3b82f6' },
  data: smaData,
};
addIndicatorPanel(panel);
```

#### New Code
```typescript
const instance = addIndicator('sma', {
  period: 20,
  color: '#3b82f6',
});
// ID, name, and data handled automatically
```

---

For more examples, see [Examples Documentation](./examples.md).
