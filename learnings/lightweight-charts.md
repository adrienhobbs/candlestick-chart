# Lightweight Charts: Key Learnings and Gotchas

A comprehensive guide documenting key learnings, patterns, and pitfalls encountered while working with the TradingView Lightweight Charts library.

## Overview

- **Library**: [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts)
- **Version**: 5.0.0
- **Official Docs**: https://tradingview.github.io/lightweight-charts/

---

## 1. Time Format and Timestamp Handling

### Critical Understanding: Seconds vs Milliseconds

**MOST IMPORTANT GOTCHA**: Lightweight Charts expects timestamps in **seconds** (Unix time), NOT milliseconds.

```typescript
// ❌ WRONG - Will cause issues
const chartData = {
  time: Date.now(), // Returns milliseconds (1732667400000)
  value: 100
};

// ✅ CORRECT
const chartData = {
  time: Date.now() / 1000, // Convert to seconds (1732667400)
  value: 100
};
```

### Common Scenarios

**When passing data TO the chart:**
```typescript
// Converting application data (milliseconds) to chart format (seconds)
const candlestickData = bars.map(bar => ({
  time: bar.timestamp / 1000,  // Divide by 1000
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
}));
```

**When working with timestamps in calculations:**
```typescript
// Inside indicator calculations where you compare dates
const prev = new Date(bars[i - 1].timestamp);  // Already in milliseconds
const curr = new Date(bar.timestamp);          // Already in milliseconds

// ❌ WRONG - Don't multiply by 1000 if already in milliseconds
const prev = new Date(bars[i - 1].timestamp * 1000);
```

### Real Bug Example: VWAP Reset Logic

We encountered a bug where VWAP bands weren't rendering. The issue was in the daily reset logic:

```typescript
// ❌ WRONG - Multiplying by 1000 when already in milliseconds
const prev = new Date(bars[i - 1].timestamp * 1000);
const curr = new Date(bar.timestamp * 1000);

// This created dates in the far future, causing reset on every bar
// Result: sessionPrices array only ever had 1 element
// Result: Bands require 2+ elements for standard deviation calculation
// Result: All band values were NaN

// ✅ CORRECT
const prev = new Date(bars[i - 1].timestamp);
const curr = new Date(bar.timestamp);
```

### Best Practice

1. Store timestamps in milliseconds in your application
2. Divide by 1000 when passing to chart
3. Multiply by 1000 when retrieving from chart events
4. Never assume - always verify the timestamp format

---

## 2. Series Types and Data Formats

### Candlestick Series

```typescript
import { CandlestickSeries, CandlestickData, Time } from 'lightweight-charts';

const candlestickSeries = chart.addSeries(CandlestickSeries, {
  upColor: '#10b981',
  downColor: '#ef4444',
  borderVisible: false,
  wickUpColor: '#10b981',
  wickDownColor: '#ef4444',
});

const data: CandlestickData[] = bars.map(bar => ({
  time: bar.timestamp / 1000 as Time,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
}));

candlestickSeries.setData(data);
```

### Line Series

```typescript
import { LineSeries, LineData, Time } from 'lightweight-charts';

const lineSeries = chart.addSeries(LineSeries, {
  color: '#3b82f6',
  lineWidth: 2,
  title: 'SMA 20',
});

const data: LineData[] = calculations.map(point => ({
  time: point.timestamp / 1000 as Time,
  value: point.value,
}));

lineSeries.setData(data);
```

### Histogram Series

```typescript
import { HistogramSeries, HistogramData, Time } from 'lightweight-charts';

const histogramSeries = chart.addSeries(HistogramSeries, {
  color: '#64748b',
  priceFormat: {
    type: 'volume',
  },
});

const data: HistogramData[] = volumes.map(vol => ({
  time: vol.timestamp / 1000 as Time,
  value: vol.amount,
  color: vol.type === 'buy' ? '#10b981' : '#ef4444', // Optional per-bar color
}));

histogramSeries.setData(data);
```

### Type Casting Requirements

TypeScript requires explicit type casting for chart data:

```typescript
// Always cast time to Time type
time: timestamp as Time

// Cast data arrays to specific series data types
lineSeries.setData(data as LineData[]);
histogramSeries.setData(volumeData as HistogramData[]);
```

---

## 3. Data Management Patterns

### setData() vs update()

**Use `setData()`** when:
- Initial data load
- Complete data replacement
- Filtering/changing the entire dataset

**Use `update()`** when:
- Adding a single new bar
- Updating the last bar in real-time

```typescript
// Initial load
candlestickSeries.setData(allBars);

// Real-time update of last bar
candlestickSeries.update({
  time: lastBar.timestamp / 1000 as Time,
  open: lastBar.open,
  high: lastBar.high,
  low: lastBar.low,
  close: lastBar.close,
});
```

### Handling NaN Values

Always filter out NaN values before passing to chart:

```typescript
// ✅ CORRECT - Filter NaN values
const validData = calculatedData
  .filter(point => !isNaN(point.value))
  .map(point => ({
    time: point.time as Time,
    value: point.value,
  }));

lineSeries.setData(validData as LineData[]);
```

### Data Sorting

Lightweight Charts requires data in chronological order:

```typescript
// Ensure data is sorted by time
const sortedData = [...data].sort((a, b) => a.time - b.time);
series.setData(sortedData);
```

### Managing Series References

Use Map for tracking multiple series:

```typescript
const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());

// Adding series
indicatorSeriesRef.current.set(`${indicator.id}-upper`, upperSeries);

// Cleanup when indicators change
indicatorSeriesRef.current.forEach(series => {
  chart.removeSeries(series);
});
indicatorSeriesRef.current.clear();
```

---

## 4. Custom Primitives (Advanced)

### What Are Primitives?

Primitives allow custom drawing on the chart canvas. Use them for:
- Custom shapes and annotations
- Fill areas between lines (like Bollinger Bands)
- Complex visualizations not supported by built-in series

### The ISeriesPrimitive Interface

```typescript
import { ISeriesPrimitive, SeriesAttachedParameter, Time } from 'lightweight-charts';

export class CustomPrimitive implements ISeriesPrimitive<Time> {
  // Called when primitive is attached to a series
  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
  }

  // Called when primitive is detached
  detached(): void {
    this._chart = null;
    this._series = null;
  }

  // Returns array of pane views for rendering
  paneViews() {
    return this._paneViews;
  }

  // Trigger update of all views
  updateAllViews(): void {
    this._paneViews.forEach(view => view.update());
  }
}
```

### BandsPrimitive Example

Complete implementation for filling area between two lines:

```typescript
export class BandsPrimitive implements ISeriesPrimitive<Time> {
  _options: BandsPrimitiveOptions;
  _upperSeries: ISeriesApi<'Line'>;
  _lowerSeries: ISeriesApi<'Line'>;
  _chart: IChartApi | null = null;
  _series: ISeriesApi<'Line'> | null = null;
  private _paneViews: AreaBetweenLinesPaneView[];

  constructor(options: BandsPrimitiveOptions) {
    this._options = options;
    this._upperSeries = options.upperSeries;
    this._lowerSeries = options.lowerSeries;
    this._paneViews = [new AreaBetweenLinesPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._paneViews.forEach(pw => pw.update());
  }
}
```

### Coordinate Conversion in Primitives

```typescript
// Convert time to X coordinate
const x = timeScale.timeToCoordinate(dataPoint.time);

// Convert price to Y coordinate
const y1 = upperSeries.priceToCoordinate(upperValue);
const y2 = lowerSeries.priceToCoordinate(lowerValue);

// Check for null (point might be outside visible range)
if (x !== null && y1 !== null && y2 !== null) {
  points.push({ x, y1, y2 });
}
```

### Canvas Rendering

```typescript
draw(target: any) {
  target.useBitmapCoordinateSpace((scope: any) => {
    const ctx = scope.context;

    // Scale for proper pixel ratio
    ctx.save();
    ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);

    // Draw your shapes
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y1);

    // Draw upper line
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y1);
    }

    // Draw lower line (reverse direction)
    for (let i = points.length - 1; i >= 0; i--) {
      ctx.lineTo(points[i].x, points[i].y2);
    }

    ctx.closePath();
    ctx.fillStyle = this._data.color;
    ctx.fill();

    ctx.restore();
  });
}
```

### Attaching Primitives

```typescript
// Create series
const upperSeries = chart.addSeries(LineSeries, { color: '#ef4444' });
const lowerSeries = chart.addSeries(LineSeries, { color: '#10b981' });

// Create and attach primitive
const bandsPrimitive = new BandsPrimitive({
  upperSeries: upperSeries,
  lowerSeries: lowerSeries,
  fillColor: 'rgba(59, 130, 246, 0.1)',
});

upperSeries.attachPrimitive(bandsPrimitive);

// Don't forget to call updateAllViews after data changes
bandsPrimitive.updateAllViews();
```

---

## 5. Multiple Series on One Chart

### Pattern for Managing Multiple Indicators

```typescript
// Track series by indicator ID
const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());

// Clear old series
indicatorSeriesRef.current.forEach(series => {
  chartRef.current!.removeSeries(series);
});
indicatorSeriesRef.current.clear();

// Add new series for each indicator
indicators.forEach(indicator => {
  const definition = indicatorRegistry.get(indicator.indicatorId);
  const data = indicatorCalculator.calculate(
    indicator.indicatorId,
    bars,
    indicator.settings
  );

  if (definition.renderConfig.seriesType === 'line') {
    const series = chartRef.current!.addSeries(LineSeries, {
      color: indicator.settings.color || '#3b82f6',
      lineWidth: indicator.settings.lineWidth || 2,
      title: indicator.name,
    });

    series.setData(data as LineData[]);
    indicatorSeriesRef.current.set(indicator.id, series);
  }
});
```

### Band Indicators (Upper/Middle/Lower)

```typescript
// Create three series for bands
const upperSeries = chart.addSeries(LineSeries, {
  color: settings.upperColor || '#ef4444',
  lineWidth: settings.lineWidth || 2,
  title: `${name} Upper`,
});

const middleSeries = chart.addSeries(LineSeries, {
  color: settings.middleColor || '#3b82f6',
  lineWidth: settings.lineWidth || 2,
  title: `${name} Middle`,
});

const lowerSeries = chart.addSeries(LineSeries, {
  color: settings.lowerColor || '#10b981',
  lineWidth: settings.lineWidth || 2,
  title: `${name} Lower`,
});

// Extract data for each band
const upperData = data.map(d => ({
  time: d.time as Time,
  value: d.upper
})).filter(d => !isNaN(d.value));

const middleData = data.map(d => ({
  time: d.time as Time,
  value: d.value
})).filter(d => !isNaN(d.value));

const lowerData = data.map(d => ({
  time: d.time as Time,
  value: d.lower
})).filter(d => !isNaN(d.value));

// Set data
upperSeries.setData(upperData as LineData[]);
middleSeries.setData(middleData as LineData[]);
lowerSeries.setData(lowerData as LineData[]);

// Add fill between bands
const bandsPrimitive = new BandsPrimitive({
  upperSeries: upperSeries,
  lowerSeries: lowerSeries,
  fillColor: settings.fillColor || 'rgba(59, 130, 246, 0.1)',
});
upperSeries.attachPrimitive(bandsPrimitive);

// Store all series
indicatorSeriesRef.current.set(`${id}-upper`, upperSeries);
indicatorSeriesRef.current.set(`${id}-middle`, middleSeries);
indicatorSeriesRef.current.set(`${id}-lower`, lowerSeries);
```

---

## 6. Separate Panes (Multi-Chart Setup)

### Creating Oscillator Panes

Some indicators (RSI, MACD) need their own separate chart below the main chart:

```typescript
// Create separate container
const separatePaneContainer = document.createElement('div');
separatePaneContainer.style.height = '200px';
separatePaneContainer.style.marginTop = '4px';
parentContainer.appendChild(separatePaneContainer);

// Create separate chart
const separateChart = createChart(separatePaneContainer, {
  layout: {
    background: { type: 'solid', color: '#0f172a' },
    textColor: '#94a3b8',
  },
  width: separatePaneContainer.clientWidth,
  height: 200,
  timeScale: {
    visible: true,
    timeVisible: true,
  },
});

// Add series to separate chart
const oscillatorSeries = separateChart.addSeries(LineSeries, {
  color: '#3b82f6',
  lineWidth: 2,
  title: 'RSI',
});

oscillatorSeries.setData(data as LineData[]);
```

### Syncing Time Scales

Keep separate panes synchronized with main chart:

```typescript
// Main chart time scale change
chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(() => {
  const timeRange = chartRef.current!.timeScale().getVisibleLogicalRange();

  // Update all separate pane charts
  separatePaneCharts.current.forEach(({ chart }) => {
    chart.timeScale().setVisibleLogicalRange(timeRange);
  });
});

// Separate chart time scale change
separateChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
  const timeRange = separateChart.timeScale().getVisibleLogicalRange();

  // Update main chart
  chartRef.current!.timeScale().setVisibleLogicalRange(timeRange);

  // Update other separate charts
  separatePaneCharts.current.forEach(({ chart }) => {
    if (chart !== separateChart) {
      chart.timeScale().setVisibleLogicalRange(timeRange);
    }
  });
});
```

---

## 7. Price Lines and Markers

### Creating Price Lines

```typescript
import { IPriceLine, LineStyle } from 'lightweight-charts';

const priceLine: IPriceLine = candlestickSeries.createPriceLine({
  price: 100.50,
  color: '#ef4444',
  lineWidth: 2,
  lineStyle: LineStyle.Solid,
  axisLabelVisible: true,
  title: 'Stop Loss',
});

// Store reference for later removal
priceLineRefs.current.set('stop-loss', priceLine);
```

### Removing Price Lines

```typescript
// Remove specific line
const priceLine = priceLineRefs.current.get('stop-loss');
if (priceLine) {
  candlestickSeries.removePriceLine(priceLine);
  priceLineRefs.current.delete('stop-loss');
}

// Remove all lines
priceLineRefs.current.forEach(line => {
  candlestickSeries.removePriceLine(line);
});
priceLineRefs.current.clear();
```

### Series Markers

```typescript
import { createSeriesMarkers } from 'lightweight-charts';

const markers = createSeriesMarkers([
  {
    time: timestamp / 1000 as Time,
    position: 'aboveBar',
    color: '#10b981',
    shape: 'arrowUp',
    text: 'Buy',
  },
  {
    time: timestamp2 / 1000 as Time,
    position: 'belowBar',
    color: '#ef4444',
    shape: 'arrowDown',
    text: 'Sell',
  },
]);

candlestickSeries.setMarkers(markers);
```

---

## 8. Coordinate Conversions and Mouse Events

### Converting Coordinates

```typescript
// Get price from Y coordinate
const price = candlestickSeries.coordinateToPrice(event.clientY);

// Get time from X coordinate (returns Time | null)
const timeScale = chart.timeScale();
const time = timeScale.coordinateToTime(event.clientX);

// Reverse conversions
const yCoord = candlestickSeries.priceToCoordinate(price);
const xCoord = timeScale.timeToCoordinate(time);
```

### Context Menu Example

```typescript
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();

  const rect = chartContainerRef.current!.getBoundingClientRect();
  const y = event.clientY - rect.top;

  const price = candlestickSeries.coordinateToPrice(y);

  if (price !== null) {
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      price: price,
    });
  }
};

chartContainerRef.current.addEventListener('contextmenu', handleContextMenu);
```

### Click Events with Bar Data

```typescript
const handleClick = (event: MouseEvent) => {
  const rect = chartContainerRef.current!.getBoundingClientRect();
  const x = event.clientX - rect.left;

  const timeScale = chartRef.current!.timeScale();
  const time = timeScale.coordinateToTime(x);

  if (time !== null) {
    // Find bar at this time
    const clickedBar = bars.find(bar =>
      Math.abs(bar.timestamp / 1000 - (time as number)) < 30
    );

    if (clickedBar) {
      onBarClick(clickedBar);
    }
  }
};
```

---

## 9. Performance Considerations

### Use Refs for Chart Instances

```typescript
// ✅ CORRECT - Chart persists across renders
const chartRef = useRef<IChartApi | null>(null);

useEffect(() => {
  if (!chartRef.current) {
    chartRef.current = createChart(container, options);
  }

  return () => {
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
  };
}, []); // Empty dependencies - chart created once
```

### Efficient Data Updates

```typescript
// ❌ WRONG - Recreates series on every data change
useEffect(() => {
  const series = chart.addSeries(LineSeries);
  series.setData(data);
}, [data]);

// ✅ CORRECT - Reuses series
const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

useEffect(() => {
  if (!seriesRef.current) {
    seriesRef.current = chart.addSeries(LineSeries);
  }
  seriesRef.current.setData(data);
}, [data]);
```

### Filtering NaN Early

```typescript
// Filter NaN values before processing
const validData = indicatorData.filter(d => !isNaN(d.value));

// Then map to chart format
const chartData = validData.map(d => ({
  time: d.time as Time,
  value: d.value,
}));
```

---

## 10. Styling and Theming

### Chart Layout Options

```typescript
const chart = createChart(container, {
  layout: {
    background: { type: 'solid', color: '#0f172a' },
    textColor: '#94a3b8',
    fontSize: 12,
    fontFamily: 'system-ui',
  },
  grid: {
    vertLines: {
      color: '#1e293b',
      style: LineStyle.Solid,
      visible: true,
    },
    horzLines: {
      color: '#1e293b',
      style: LineStyle.Solid,
      visible: true,
    },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      width: 1,
      color: '#475569',
      style: LineStyle.Dashed,
      labelBackgroundColor: '#1e293b',
    },
    horzLine: {
      width: 1,
      color: '#475569',
      style: LineStyle.Dashed,
      labelBackgroundColor: '#1e293b',
    },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: true,
    borderColor: '#334155',
    borderVisible: true,
  },
  rightPriceScale: {
    borderColor: '#334155',
    borderVisible: true,
    scaleMargins: {
      top: 0.1,
      bottom: 0.2,
    },
  },
});
```

### Series Styling

```typescript
// Candlestick
const candlestickSeries = chart.addSeries(CandlestickSeries, {
  upColor: '#10b981',
  downColor: '#ef4444',
  borderVisible: false,
  wickUpColor: '#10b981',
  wickDownColor: '#ef4444',
  borderUpColor: '#10b981',
  borderDownColor: '#ef4444',
});

// Line
const lineSeries = chart.addSeries(LineSeries, {
  color: '#3b82f6',
  lineWidth: 2,
  lineStyle: LineStyle.Solid,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4,
  lastValueVisible: true,
  priceLineVisible: true,
  title: 'Indicator Name',
});

// Histogram
const volumeSeries = chart.addSeries(HistogramSeries, {
  color: '#64748b',
  priceFormat: {
    type: 'volume',
  },
  priceScaleId: 'volume',
});
```

---

## 11. Common Pitfalls and Solutions

### Issue: Bands Not Rendering

**Symptoms**: Three line series are visible but no fill between them

**Root Causes**:
1. Upper/lower data arrays are empty or all NaN
2. Data format doesn't match expected structure
3. Primitive not attached or updateAllViews() not called

**Solution**:
```typescript
// Check data arrays
console.log('Upper data length:', upperData.length);
console.log('Lower data length:', lowerData.length);

// Ensure data is valid
const upperData = rawData
  .map(d => ({ time: d.time as Time, value: d.upper }))
  .filter(d => !isNaN(d.value)); // Critical filter

// Check primitive attachment
bandsPrimitive.updateAllViews(); // Call after data changes
```

### Issue: Incorrect Time Comparisons

**Symptoms**: Daily resets happening on every bar, indicators calculating wrong

**Root Cause**: Timestamp unit mismatch (milliseconds vs seconds)

**Solution**:
```typescript
// ❌ WRONG
const prev = new Date(bars[i - 1].timestamp * 1000); // Already in ms!

// ✅ CORRECT
const prev = new Date(bars[i - 1].timestamp); // Timestamps already in ms
```

### Issue: Data Not Updating

**Symptoms**: Chart shows old data after state change

**Root Cause**: Using update() when should use setData()

**Solution**:
```typescript
// For complete data replacement
series.setData(newData);

// Only for real-time last bar update
series.update(lastBarData);
```

### Issue: Series Not Visible

**Symptoms**: Series added but nothing shows on chart

**Possible Causes**:
1. Data is empty or all NaN
2. Time format wrong (milliseconds instead of seconds)
3. Data not in chronological order
4. Price scale auto-scaling issue

**Solution**:
```typescript
// Verify data
console.log('Data length:', data.length);
console.log('Sample:', data.slice(0, 3));

// Check for NaN
const validCount = data.filter(d => !isNaN(d.value)).length;
console.log('Valid data points:', validCount);

// Force auto-scale
chart.timeScale().fitContent();
```

### Issue: Primitive Not Drawing

**Symptoms**: attachPrimitive() called but nothing renders

**Solution**:
```typescript
// Ensure updateAllViews() is called after data changes
upperSeries.setData(upperData);
lowerSeries.setData(lowerData);
bandsPrimitive.updateAllViews(); // Critical call

// Also call on chart time scale changes
chart.timeScale().subscribeVisibleTimeRangeChange(() => {
  bandsPrimitive.updateAllViews();
});
```

---

## 12. Integration with React

### Chart Lifecycle

```typescript
useEffect(() => {
  if (!chartContainerRef.current) return;

  // Create chart once
  const chart = createChart(chartContainerRef.current, {
    // ... options
  });
  chartRef.current = chart;

  // Add series
  const candlestickSeries = chart.addSeries(CandlestickSeries);
  candlestickSeriesRef.current = candlestickSeries;

  // Cleanup
  return () => {
    chart.remove();
    chartRef.current = null;
  };
}, []); // Empty deps - create once
```

### Data Updates

```typescript
// Separate effect for data updates
useEffect(() => {
  if (!candlestickSeriesRef.current || !bars.length) return;

  const chartData = bars.map(bar => ({
    time: bar.timestamp / 1000 as Time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }));

  candlestickSeriesRef.current.setData(chartData);
}, [bars]);
```

### Event Listeners

```typescript
useEffect(() => {
  const container = chartContainerRef.current;
  if (!container) return;

  const handleClick = (event: MouseEvent) => {
    // Handle click
  };

  // Use capture phase for priority
  container.addEventListener('click', handleClick, { capture: true });

  return () => {
    container.removeEventListener('click', handleClick, { capture: true });
  };
}, [/* dependencies */]);
```

### Drag Detection

```typescript
const isDraggingRef = useRef(false);
const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

const handleMouseDown = (event: MouseEvent) => {
  mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
};

const handleMouseMove = (event: MouseEvent) => {
  if (mouseDownPosRef.current) {
    const dx = Math.abs(event.clientX - mouseDownPosRef.current.x);
    const dy = Math.abs(event.clientY - mouseDownPosRef.current.y);

    if (dx > 5 || dy > 5) {
      isDraggingRef.current = true;
    }
  }
};

const handleMouseUp = (event: MouseEvent) => {
  if (!isDraggingRef.current) {
    // Was a click, not a drag
    handleClick(event);
  }

  isDraggingRef.current = false;
  mouseDownPosRef.current = null;
};
```

---

## 13. Chart Interactions

### Infinite Scroll (Load More Data)

```typescript
useEffect(() => {
  if (!chartRef.current) return;

  const handleVisibleLogicalRangeChange = () => {
    const logicalRange = chartRef.current!.timeScale().getVisibleLogicalRange();

    if (logicalRange && logicalRange.from < 10 && !isLoadingRef.current) {
      isLoadingRef.current = true;

      // Load older data
      const oldestBar = bars[0];
      onLoadMoreData?.(oldestBar.timestamp);
    }
  };

  chartRef.current.timeScale()
    .subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

  return () => {
    chartRef.current?.timeScale()
      .unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
  };
}, [bars, onLoadMoreData]);
```

### Bar Selection with Visual Feedback

```typescript
const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);
const [spotlightPosition, setSpotlightPosition] = useState<{
  x: number;
  width: number;
} | null>(null);

const handleBarClick = (bar: OHLCVBar) => {
  setSelectedBar(bar);

  // Calculate spotlight position
  const timeScale = chartRef.current!.timeScale();
  const x = timeScale.timeToCoordinate(bar.timestamp / 1000);

  if (x !== null) {
    setSpotlightPosition({ x, width: 10 });
  }
};

// Render spotlight overlay
{spotlightPosition && (
  <div
    style={{
      position: 'absolute',
      left: `${spotlightPosition.x}px`,
      width: `${spotlightPosition.width}px`,
      height: '100%',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      pointerEvents: 'none',
    }}
  />
)}
```

---

## 14. Resources and References

### Official Documentation
- [Lightweight Charts GitHub](https://github.com/tradingview/lightweight-charts)
- [API Documentation](https://tradingview.github.io/lightweight-charts/docs/api)
- [Migration Guide (v3 to v4)](https://tradingview.github.io/lightweight-charts/docs/migrations/from-v3-to-v4)
- [Examples](https://tradingview.github.io/lightweight-charts/docs/examples)

### Key Files in This Codebase
- Chart Component: `src/components/ChartComponent.tsx`
- Custom Primitive: `src/indicators/primitives/BandsPrimitive.ts`
- Indicator Calculations: `src/indicators/utils/calculations.ts`
- Indicator Registry: `src/indicators/registry/`

### Common Imports

```typescript
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  CandlestickData,
  LineSeries,
  LineData,
  HistogramSeries,
  HistogramData,
  AreaSeries,
  Time,
  IPriceLine,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';
```

---

## Quick Reference

### Critical Points to Remember

1. **Timestamps**: Always in seconds for the chart, divide by 1000
2. **NaN filtering**: Filter before passing to chart
3. **Data sorting**: Must be chronological order
4. **Type casting**: Use `as Time`, `as LineData[]`, etc.
5. **Primitives**: Call `updateAllViews()` after data changes
6. **React**: Use refs for chart instances, avoid recreation
7. **Performance**: Reuse series, don't recreate on every render
8. **Cleanup**: Always remove chart and unsubscribe listeners

### Debugging Checklist

When something doesn't work:

- [ ] Check timestamp format (seconds vs milliseconds)
- [ ] Verify data arrays aren't empty
- [ ] Check for NaN values in data
- [ ] Confirm data is sorted chronologically
- [ ] Verify type casting is correct
- [ ] Check console for errors
- [ ] Ensure cleanup is happening properly
- [ ] Verify refs are being used correctly
- [ ] Check that updateAllViews() is called (for primitives)
- [ ] Confirm event listeners are attached

---

**Last Updated**: 2025-11-26
**Library Version**: 5.0.0
