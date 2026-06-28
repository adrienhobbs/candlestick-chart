import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  createChart,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LineData,
  HistogramData,
  IPriceLine,
  LineStyle,
  LineWidth,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  SeriesMarker,
} from 'lightweight-charts';
import { OHLCVBar, ChartLine, ChartTrade, PriceBand, ChartTheme } from '../types/chart';
import { IndicatorInstance } from '../indicators/core/types';
import { indicatorRegistry } from '../indicators/core/registry';
import { indicatorCalculator } from '../indicators/core/calculator';
import { BandsPrimitive } from '../indicators/primitives/BandsPrimitive';
import { buildTradeMarkers } from './trade-markers';

interface ChartComponentProps {
  bars: OHLCVBar[];
  onLoadMoreData?: (oldestTimestamp: number) => void;
  indicators?: IndicatorInstance[];
  lines?: ChartLine[];
  onBarUpdate?: (updatedBar: OHLCVBar) => void;
  onNewBar?: (newBar: OHLCVBar) => void;
  onDeleteLine?: (lineId: string) => void;
  onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance', price: number) => void;
  onClearAllLines?: () => void;
  enableBarSelection?: boolean;
  onBarClick?: (bar: OHLCVBar | null) => void;
  /**
   * Externally control the selected bar (the spotlight) by ms timestamp. When
   * provided (incl. `null`), bar selection becomes controlled: clicks still fire
   * `onBarClick`, but the highlight follows this prop — so a parent can move the
   * selection (e.g. arrow keys). Omit for the default click-toggle behavior.
   */
  selectedBarTime?: number | null;
  trades?: ChartTrade[];
  selectedTradeId?: string | null;
  renderTradePopup?: (trade: ChartTrade) => ReactNode;
  /**
   * Fixed chart height in px. When omitted, the chart fills its container's
   * height (observed via ResizeObserver) instead of a fixed default — so a
   * flex/percent-sized parent gets a full-height chart.
   */
  height?: number;
  /**
   * When set, recenter the time scale on this trade (by id) so it scrolls into
   * view. Pairs with `selectedTradeId` to drive both selection and focus.
   */
  focusTradeId?: string | null;
  /**
   * IANA timezone (e.g. "America/New_York") for the axis ticks + crosshair
   * labels. Omit to use the viewer's local timezone.
   */
  timeZone?: string;
  /** Shaded horizontal price bands (e.g. an MFE↔MAE excursion zone). */
  priceBands?: PriceBand[];
  /**
   * Visual theme for the chart canvas (background, grid, axes, candles, volume).
   * A partial override of {@link DEFAULT_CHART_THEME}; re-applied live on change.
   */
  theme?: Partial<ChartTheme>;
}

// Library default chart theme (slate dark). Consumers override via the `theme` prop.
const DEFAULT_CHART_THEME: ChartTheme = {
  background: '#0f172a',
  textColor: '#94a3b8',
  fontFamily: undefined,
  gridColor: '#1e293b',
  axisBorderColor: '#334155',
  crosshairColor: '#475569',
  paneSeparatorColor: '#1e293b',
  upColor: '#10b981',
  downColor: '#ef4444',
  volumeUpColor: '#10b98180',
  volumeDownColor: '#ef444480',
};

// Palette for multi-output indicators whose fields lack an explicit color setting.
const MULTI_LINE_PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#a855f7', '#06b6d4'];

// Default share of the chart height given to the volume pane (price action dominates).
const VOLUME_PANE_FRACTION = 0.14;

// Color for a named output field of a multi-output indicator: prefer an explicit
// `<field>Color` setting, fall back to the generic `color` for the primary
// `value` series, else a stable palette slot.
function fieldColor(settings: Record<string, any>, key: string, idx: number): string {
  return (
    settings[`${key}Color`] ||
    (key === 'value' ? settings.color : undefined) ||
    MULTI_LINE_PALETTE[idx % MULTI_LINE_PALETTE.length]
  );
}

// Output field names of a calculated indicator point (everything but `time`).
function outputFieldKeys(point: Record<string, number>): string[] {
  return Object.keys(point).filter((k) => k !== 'time');
}

export default function ChartComponent({
  bars,
  onLoadMoreData,
  indicators = [],
  lines = [],
  onBarUpdate,
  onNewBar,
  onDeleteLine,
  onAddLine,
  onClearAllLines,
  enableBarSelection = true,
  onBarClick,
  selectedBarTime,
  trades = [],
  selectedTradeId = null,
  renderTradePopup,
  height,
  focusTradeId = null,
  timeZone,
  priceBands = [],
  theme,
}: ChartComponentProps) {
  // Merge the consumer's partial theme over the library default. `theme` should
  // be memoized by the caller; a stable identity keeps the live-apply effect from
  // thrashing. Read inside non-reactive closures (create/bars effects) via the ref.
  const resolvedTheme: ChartTheme = useMemo(
    () => ({ ...DEFAULT_CHART_THEME, ...theme }),
    [theme],
  );
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const indicatorPaneIndexRef = useRef<Map<string, number>>(new Map());
  const nextPaneIndexRef = useRef<number>(2);
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map());
  const seriesMarkersRef = useRef<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);
  const [linePositions, setLinePositions] = useState<Map<string, { top: number; right: number }>>(new Map());
  // Shaded price-band rects (container-relative px), recomputed as the price scale moves.
  const [bandRects, setBandRects] = useState<Array<{ id: string; top: number; height: number; color: string }>>([]);
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);
  const selectedBarRef = useRef<OHLCVBar | null>(null);
  // Bar selection is "controlled" when `selectedBarTime` is passed — the click
  // handler then only notifies (via onBarClick) and lets the prop drive the
  // highlight. Read via ref inside the create-once click closure.
  const barSelectionControlled = selectedBarTime !== undefined;
  const barSelectionControlledRef = useRef(barSelectionControlled);
  barSelectionControlledRef.current = barSelectionControlled;

  // Controlled bar selection: mirror `selectedBarTime` into selectedBar (the
  // spotlight + selection marker follow it).
  useEffect(() => {
    if (!barSelectionControlled) return;
    const bar =
      selectedBarTime == null
        ? null
        : barsRef.current.find((b) => b.timestamp === selectedBarTime) ?? null;
    selectedBarRef.current = bar;
    setSelectedBar(bar);
  }, [selectedBarTime, barSelectionControlled, bars]);

  // Size the volume pane to a small fraction of the chart so price action stays
  // dominant. Absolute px (this lightweight-charts build has no stretch factors),
  // so it's re-applied whenever the chart height changes.
  const sizeVolumePane = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const panes = chart.panes();
    if (panes.length < 2) return;
    const totalH = chartContainerRef.current?.clientHeight ?? 0;
    if (totalH <= 0) return;
    panes[1].setHeight(Math.max(48, Math.round(totalH * VOLUME_PANE_FRACTION)));
  }, []);
  const [spotlightPosition, setSpotlightPosition] = useState<{ x: number; width: number } | null>(null);
  const [tradePopupPos, setTradePopupPos] = useState<{ x: number } | null>(null);
  const previousBarsRef = useRef<OHLCVBar[]>([]);
  const previousBarsLengthRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const barsRef = useRef<OHLCVBar[]>(bars);
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  // Latest explicit height (px) or undefined for auto-fill; read inside the
  // create-once effect's resize closure without going stale.
  const heightRef = useRef<number | undefined>(height);
  heightRef.current = height;
  // Line-editing is opt-in: the right-click "add line" menu only opens when a
  // consumer wires the add/clear handlers. Read via ref from the create-once
  // contextmenu closure without going stale. (Delete buttons gate on
  // `onDeleteLine` directly at render.)
  const lineEditEnabledRef = useRef(false);
  lineEditEnabledRef.current = Boolean(onAddLine || onClearAllLines);


  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartContainerRef.current.style.position = 'relative';

    const t = themeRef.current;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: t.background },
        textColor: t.textColor,
        ...(t.fontFamily ? { fontFamily: t.fontFamily } : {}),
        panes: {
          enableResize: true,
          separatorColor: t.paneSeparatorColor,
          separatorHoverColor: 'rgba(148,163,184,0.5)',
        },
      },
      grid: {
        vertLines: { color: t.gridColor },
        horzLines: { color: t.gridColor },
      },
      // Render axis ticks + crosshair in `timeZone` (default: the viewer's local
      // timezone). lightweight-charts otherwise renders numeric times as UTC,
      // which mismatches local/exchange-time labels alongside the chart.
      localization: {
        timeFormatter: makeCrosshairTimeFormatter(timeZone),
      },
      width: chartContainerRef.current.clientWidth,
      // Auto-fill the container's height unless an explicit `height` is given.
      // Fall back to 600 only when the container hasn't been laid out yet (a
      // ResizeObserver below corrects it on first measure).
      height: height ?? (chartContainerRef.current.clientHeight || 600),
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: t.axisBorderColor,
        tickMarkFormatter: makeTickMarkFormatter(timeZone),
      },
      rightPriceScale: {
        borderColor: t.axisBorderColor,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: t.crosshairColor,
          style: 3,
        },
        horzLine: {
          width: 1,
          color: t.crosshairColor,
          style: 3,
        },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: t.upColor,
      downColor: t.downColor,
      borderVisible: false,
      wickUpColor: t.upColor,
      wickDownColor: t.downColor,
    }, 0);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: t.volumeUpColor,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    }, 1);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Shrink the volume pane by default — price action should dominate.
    sizeVolumePane();

    seriesMarkersRef.current = createSeriesMarkers(candlestickSeries, []);

    chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      if (logicalRange && logicalRange.from < 5 && !isLoadingRef.current && onLoadMoreData) {
        isLoadingRef.current = true;
        setIsLoadingMore(true);
        previousBarsLengthRef.current = barsRef.current.length;
        const sortedBars = [...barsRef.current].sort((a, b) => a.timestamp - b.timestamp);
        const oldestTimestamp = sortedBars[0]?.timestamp;
        if (oldestTimestamp) {
          onLoadMoreData(oldestTimestamp);
        }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        const nextHeight = heightRef.current ?? chartContainerRef.current.clientHeight;
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          // Only drive height when auto-filling and the container has a real
          // measured height; otherwise leave the current height untouched.
          ...(heightRef.current === undefined && nextHeight > 0 ? { height: nextHeight } : {}),
          ...(heightRef.current !== undefined ? { height: heightRef.current } : {}),
        });
      }
    };

    // A flex/percent-sized parent changes the container without firing window
    // 'resize'; observe the container directly so the chart tracks it.
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    const handleContextMenu = (e: MouseEvent) => {
      // No line-editing handlers wired → no custom menu; leave the native
      // context menu alone (read-only charts, e.g. the trades overlay).
      if (!lineEditEnabledRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      if (!candlestickSeriesRef.current) {
        return;
      }

      const rect = chartContainerRef.current!.getBoundingClientRect();
      const y = e.clientY - rect.top;

      const price = candlestickSeriesRef.current.coordinateToPrice(y);

      if (price !== null) {
        setContextMenu({
          x: e.clientX - rect.left,
          y: y,
          price: price as number,
        });
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > 5 || dy > 5) {
          isDraggingRef.current = true;
        }
      }
    };

    const handleMouseUp = () => {
      mouseDownPosRef.current = null;
    };

    const handleClick = (e: MouseEvent) => {
      setContextMenu(null);

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        return;
      }


      if (!enableBarSelection) {
        return;
      }

      if (!chartRef.current) {
        return;
      }

      if (!candlestickSeriesRef.current) {
        return;
      }


      const rect = chartContainerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const timeScale = chartRef.current.timeScale();
      const coordinate = timeScale.coordinateToTime(x);

      if (!coordinate) {
        return;
      }

      const clickedTime = coordinate as number;

      const clickedBar = barsRef.current.find(bar => {
        const diff = Math.abs((bar.timestamp / 1000) - clickedTime);
        return diff < 300;
      });

      if (clickedBar) {
        if (barSelectionControlledRef.current) {
          // Controlled: let the parent drive the highlight via `selectedBarTime`.
          if (onBarClick) onBarClick(clickedBar);
        } else if (selectedBarRef.current && selectedBarRef.current.timestamp === clickedBar.timestamp) {
          selectedBarRef.current = null;
          setSelectedBar(null);
          setSpotlightPosition(null);
          if (onBarClick) {
            onBarClick(null);
          }
        } else {
          selectedBarRef.current = clickedBar;
          setSelectedBar(clickedBar);
          const barX = timeScale.timeToCoordinate((clickedBar.timestamp / 1000) as Time);
          if (barX !== null) {
            const barWidth = Math.max(8, rect.width / barsRef.current.length);
            setSpotlightPosition({ x: barX - barWidth / 2, width: barWidth });
          }
          if (onBarClick) {
            onBarClick(clickedBar);
          }
        }
      } else {
      }
    };

    window.addEventListener('resize', handleResize);
    chartContainerRef.current.addEventListener('contextmenu', handleContextMenu, true);
    chartContainerRef.current.addEventListener('mousedown', handleMouseDown, true);
    chartContainerRef.current.addEventListener('mousemove', handleMouseMove, true);
    chartContainerRef.current.addEventListener('mouseup', handleMouseUp, true);
    chartContainerRef.current.addEventListener('click', handleClick, true);

    const container = chartContainerRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      container.removeEventListener('contextmenu', handleContextMenu, true);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mousemove', handleMouseMove, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('click', handleClick, true);
      chart.remove();
      // `chart.remove()` disposes every series this chart owned. Drop the stale
      // series references too — otherwise a remount (e.g. React StrictMode's
      // double-invoke) re-runs the indicator effect, which would call
      // `removeSeries` on these now-disposed series via the *new* chart and throw
      // "Value is undefined". Only bites when an indicator is present at mount.
      indicatorSeriesRef.current.clear();
      indicatorPaneIndexRef.current.clear();
      nextPaneIndexRef.current = 2;
      // Reset the bars-diff trackers too. They persist across a remount, so the
      // next chart's bars effect would otherwise see prev === current and take the
      // single-bar `update()` path on its *fresh, empty* candle series — leaving
      // only one candle (price scale collapses; candles look missing). Clearing
      // forces a full setData on the new series. (Bites StrictMode's double mount.)
      previousBarsRef.current = [];
      previousBarsLengthRef.current = 0;
    };
  }, []);

  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  // Apply an explicit `height` prop change (the create-once effect can't), and
  // re-apply the volume pane's fractional size against the new total height.
  useEffect(() => {
    if (chartRef.current && height !== undefined) {
      chartRef.current.applyOptions({ height });
      sizeVolumePane();
    }
  }, [height, sizeVolumePane]);

  // Re-theme the existing chart live when `theme` changes (e.g. a host app's
  // dark/light toggle) — no recreate. Candle colors are series options; volume
  // bar colors live in the data, so they're re-set from the current bars.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: resolvedTheme.background },
        textColor: resolvedTheme.textColor,
        ...(resolvedTheme.fontFamily ? { fontFamily: resolvedTheme.fontFamily } : {}),
        panes: { separatorColor: resolvedTheme.paneSeparatorColor },
      },
      grid: {
        vertLines: { color: resolvedTheme.gridColor },
        horzLines: { color: resolvedTheme.gridColor },
      },
      timeScale: { borderColor: resolvedTheme.axisBorderColor },
      rightPriceScale: { borderColor: resolvedTheme.axisBorderColor },
      crosshair: {
        vertLine: { color: resolvedTheme.crosshairColor },
        horzLine: { color: resolvedTheme.crosshairColor },
      },
    });
    candlestickSeriesRef.current?.applyOptions({
      upColor: resolvedTheme.upColor,
      downColor: resolvedTheme.downColor,
      wickUpColor: resolvedTheme.upColor,
      wickDownColor: resolvedTheme.downColor,
    });
    const vol = volumeSeriesRef.current;
    if (vol && barsRef.current.length > 0) {
      vol.setData(
        barsRef.current.map((bar) => ({
          time: (bar.timestamp / 1000) as Time,
          value: bar.volume,
          color: bar.close >= bar.open ? resolvedTheme.volumeUpColor : resolvedTheme.volumeDownColor,
        })),
      );
    }
  }, [resolvedTheme]);

  // Recenter the time scale on `focusTradeId` so the trade scrolls into view.
  // Re-runs when the focus target or the loaded bars change (the bars covering
  // the trade may arrive after selection), then frames [entry, exit] with pad.
  // The range is applied on the next animation frame so it lands AFTER the
  // sibling bars→setData effect (which would otherwise snap the view back).
  useEffect(() => {
    if (!chartRef.current || !focusTradeId) return;
    const trade = trades.find((t) => t.id === focusTradeId);
    if (!trade) return;
    // Frame by LOGICAL (bar-index) range, not time: lazy-loading a far-off trade
    // leaves a big gap between bar clusters, and a time-based setVisibleRange
    // won't reliably land on the far cluster. Build the same ascending, deduped
    // order candlekit feeds to setData so indices line up, then frame the trade.
    const seen = new Set<number>();
    const series: number[] = [];
    for (const b of [...bars].sort((a, b) => a.timestamp - b.timestamp)) {
      if (seen.has(b.timestamp)) continue;
      seen.add(b.timestamp);
      series.push(b.timestamp);
    }
    if (series.length === 0) return;
    // First bar index at/after a target ms (binary search; series is ascending).
    const nearestIdx = (ms: number) => {
      let lo = 0;
      let hi = series.length - 1;
      let idx = series.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (series[mid] >= ms) {
          idx = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      return idx;
    };
    const entryIdx = nearestIdx(trade.entryTime);
    const exitIdx = Math.max(entryIdx, nearestIdx(trade.exitTime));
    const PAD = 15;
    const frame = () => {
      try {
        // Ensure the candle price axis auto-fits the framed window. On the initial
        // load setData auto-scrolls to the latest bars (a different price level)
        // and leaves the scale there; re-asserting autoScale *before* moving the
        // visible range makes lightweight-charts re-fit to the trade's candles
        // (otherwise they sit off-screen until the next scroll/zoom).
        candlestickSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: entryIdx - PAD,
          to: exitIdx + PAD,
        });
      } catch {
        /* bars not yet present; a later bars update re-runs this */
      }
    };
    // rAF for a snappy frame on navigation; a short timeout repeats it after the
    // initial setData's auto-scroll has settled so the first open frames too.
    const raf = requestAnimationFrame(frame);
    const timer = setTimeout(frame, 90);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [focusTradeId, trades, bars]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const sortedBars = [...bars].sort((a, b) => a.timestamp - b.timestamp);

    const uniqueBars = sortedBars.reduce((acc, bar) => {
      const exists = acc.find(b => b.timestamp === bar.timestamp);
      if (!exists) {
        acc.push(bar);
      }
      return acc;
    }, [] as OHLCVBar[]);


    const previousBars = previousBarsRef.current;
    const isInitialLoad = previousBars.length === 0;
    const hasNewBars = uniqueBars.length > previousBars.length;
    const lastBarChanged = uniqueBars.length > 0 && previousBars.length > 0 &&
      (uniqueBars[uniqueBars.length - 1].timestamp === previousBars[previousBars.length - 1].timestamp);


    if (isLoadingRef.current && uniqueBars.length > previousBarsLengthRef.current) {
      isLoadingRef.current = false;
      setIsLoadingMore(false);
    }

    if (isInitialLoad || hasNewBars) {
      const candleData: CandlestickData[] = uniqueBars.map((bar) => ({
        time: (bar.timestamp / 1000) as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      const volumeData: HistogramData[] = uniqueBars.map((bar) => ({
        time: (bar.timestamp / 1000) as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? themeRef.current.volumeUpColor : themeRef.current.volumeDownColor,
      }));

      candlestickSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
    } else if (lastBarChanged && uniqueBars.length > 0 && !hasNewBars) {
      const lastBar = uniqueBars[uniqueBars.length - 1];
      const candleUpdate: CandlestickData = {
        time: (lastBar.timestamp / 1000) as Time,
        open: lastBar.open,
        high: lastBar.high,
        low: lastBar.low,
        close: lastBar.close,
      };

      const volumeUpdate: HistogramData = {
        time: (lastBar.timestamp / 1000) as Time,
        value: lastBar.volume,
        color: lastBar.close >= lastBar.open ? themeRef.current.volumeUpColor : themeRef.current.volumeDownColor,
      };

      candlestickSeriesRef.current.update(candleUpdate);
      volumeSeriesRef.current.update(volumeUpdate);
    }

    previousBarsRef.current = uniqueBars;
  }, [bars]);

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    priceLineRefs.current.forEach((priceLine) => {
      candlestickSeriesRef.current?.removePriceLine(priceLine);
    });
    priceLineRefs.current.clear();

    lines.forEach((line) => {
      const priceLine = candlestickSeriesRef.current?.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: (line.lineWidth || 2) as LineWidth,
        lineStyle: getLineStyle(line.lineStyle),
        axisLabelVisible: true,
        title: line.title || '',
      });

      if (priceLine) {
        priceLineRefs.current.set(line.id, priceLine);
      }
    });

    requestAnimationFrame(() => {
      if (!candlestickSeriesRef.current || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const newPositions = new Map<string, { top: number; right: number }>();
      lines.forEach((line) => {
        const y = candlestickSeriesRef.current?.priceToCoordinate(line.price);
        if (y !== null && y !== undefined) {
          newPositions.set(line.id, {
            top: rect.top + y,
            right: window.innerWidth - rect.right + 68 + estimateLabelTitleWidth(line.title),
          });
        }
      });
      setLinePositions(newPositions);
    });
  }, [lines]);

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    const updatePositions = () => {
      if (!candlestickSeriesRef.current || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const newPositions = new Map<string, { top: number; right: number }>();
      lines.forEach((line) => {
        const y = candlestickSeriesRef.current?.priceToCoordinate(line.price);
        if (y !== null && y !== undefined) {
          newPositions.set(line.id, {
            top: rect.top + y,
            right: window.innerWidth - rect.right + 68 + estimateLabelTitleWidth(line.title),
          });
        }
      });
      setLinePositions(newPositions);
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updatePositions);
    window.addEventListener('scroll', updatePositions, { passive: true });
    window.addEventListener('resize', updatePositions);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(updatePositions);
      window.removeEventListener('scroll', updatePositions);
      window.removeEventListener('resize', updatePositions);
    };
  }, [lines]);

  // Shaded price bands: project top/bottom prices to container-relative px and
  // keep them in sync as the price scale auto-rescales (scroll/zoom/resize).
  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!chartRef.current || !series) return;
    if (priceBands.length === 0) {
      setBandRects([]);
      return;
    }
    const recompute = () => {
      if (!candlestickSeriesRef.current) return;
      const rects: Array<{ id: string; top: number; height: number; color: string }> = [];
      for (const band of priceBands) {
        const yTop = candlestickSeriesRef.current.priceToCoordinate(band.top);
        const yBottom = candlestickSeriesRef.current.priceToCoordinate(band.bottom);
        if (yTop == null || yBottom == null) continue;
        const top = Math.min(yTop, yBottom);
        const height = Math.abs(yBottom - yTop);
        rects.push({ id: band.id, top, height, color: band.color });
      }
      setBandRects(rects);
    };
    const raf = requestAnimationFrame(recompute);
    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf);
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [priceBands]);

  useEffect(() => {
    if (!chartRef.current) return;

    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    indicatorSeriesRef.current.clear();
    indicatorPaneIndexRef.current.clear();
    nextPaneIndexRef.current = 2;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      const seriesType = definition.renderConfig.seriesType;
      const isOverlay = definition.renderConfig.overlay !== false;
      const paneIndex = isOverlay ? 0 : nextPaneIndexRef.current;

      if (!isOverlay) {
        indicatorPaneIndexRef.current.set(indicator.id, paneIndex);
        nextPaneIndexRef.current++;
      }

      if (seriesType === 'line') {
        if (definition.renderConfig.outputCount === 1) {
          const series = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.color || '#3b82f6',
            lineWidth: indicator.settings.lineWidth || 2,
            title: indicator.name,
          }, paneIndex);
          // Drop warm-up / undefined points (e.g. an EMA's first `period` bars);
          // lightweight-charts rejects NaN/non-finite line values.
          const lineData = data
            .map(d => ({ time: d.time as Time, value: d.value }))
            .filter(d => Number.isFinite(d.value));
          series.setData(lineData as LineData[]);
          indicatorSeriesRef.current.set(indicator.id, series);
        } else if (definition.renderConfig.hasBandFill && definition.renderConfig.fillBands) {
          const { upper: upperField, lower: lowerField } = definition.renderConfig.fillBands;

          const upperSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.upperColor || '#ef4444',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Upper`,
          }, paneIndex);
          const middleSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.middleColor || indicator.settings.vwapColor || '#3b82f6',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Middle`,
          }, paneIndex);
          const lowerSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.lowerColor || '#10b981',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Lower`,
          }, paneIndex);

          const upperData = data.map(d => ({ time: d.time as Time, value: d[upperField] })).filter(d => !isNaN(d.value));
          const middleData = data.map(d => ({ time: d.time as Time, value: d.value })).filter(d => !isNaN(d.value));
          const lowerData = data.map(d => ({ time: d.time as Time, value: d[lowerField] })).filter(d => !isNaN(d.value));

          upperSeries.setData(upperData as LineData[]);
          middleSeries.setData(middleData as LineData[]);
          lowerSeries.setData(lowerData as LineData[]);

          if (indicator.settings.showFill !== false) {
            const bandsPrimitive = new BandsPrimitive({
              upperSeries: upperSeries,
              lowerSeries: lowerSeries,
              fillColor: indicator.settings.fillColor || 'rgba(59, 130, 246, 0.1)',
            });
            upperSeries.attachPrimitive(bandsPrimitive);
          }

          indicatorSeriesRef.current.set(`${indicator.id}-upper`, upperSeries);
          indicatorSeriesRef.current.set(`${indicator.id}-middle`, middleSeries);
          indicatorSeriesRef.current.set(`${indicator.id}-lower`, lowerSeries);
        } else {
          // Generic multi-output line indicator with no band fill (MACD,
          // Stochastic, StochRSI, Ichimoku, …): one series per output field.
          // A field literally named "histogram" renders as a histogram column;
          // every other numeric field renders as a line. Keyed `${id}-${field}`
          // so the bars-change effect can update each one.
          outputFieldKeys(data[0]).forEach((key, idx) => {
            const points = data
              .map((d) => ({ time: d.time as Time, value: d[key] }))
              .filter((d) => Number.isFinite(d.value));
            const title = key === 'value' ? indicator.name : `${indicator.name} ${key}`;
            const series =
              key === 'histogram'
                ? chartRef.current!.addSeries(
                    HistogramSeries,
                    { color: fieldColor(indicator.settings, key, idx), title },
                    paneIndex,
                  )
                : chartRef.current!.addSeries(
                    LineSeries,
                    {
                      color: fieldColor(indicator.settings, key, idx),
                      lineWidth: indicator.settings.lineWidth || 2,
                      title,
                    },
                    paneIndex,
                  );
            series.setData(points as (LineData | HistogramData)[]);
            indicatorSeriesRef.current.set(`${indicator.id}-${key}`, series);
          });
        }
      } else if (seriesType === 'histogram') {
        const series = chartRef.current!.addSeries(HistogramSeries, {
          color: indicator.settings.color || '#8b5cf6',
          title: indicator.name,
        }, paneIndex);
        const histData = data
          .map(d => ({ time: d.time as Time, value: d.value }))
          .filter(d => Number.isFinite(d.value));
        series.setData(histData as HistogramData[]);
        indicatorSeriesRef.current.set(indicator.id, series);
      } else if (seriesType === 'area') {
        const series = chartRef.current!.addSeries(AreaSeries, {
          topColor: indicator.settings.topColor || '#3b82f680',
          bottomColor: indicator.settings.bottomColor || '#3b82f600',
          lineColor: indicator.settings.lineColor || '#3b82f6',
          lineWidth: indicator.settings.lineWidth || 2,
          title: indicator.name,
        }, paneIndex);
        const areaData = data
          .map(d => ({ time: d.time as Time, value: d.value }))
          .filter(d => Number.isFinite(d.value));
        series.setData(areaData as LineData[]);
        indicatorSeriesRef.current.set(indicator.id, series);
      }
    });
  }, [indicators]);

  useEffect(() => {
    if (!chartRef.current || indicators.length === 0) return;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      if (definition.renderConfig.outputCount === 1) {
        const series = indicatorSeriesRef.current.get(indicator.id);
        if (series) {
          const lineData = data
            .map(d => ({ time: d.time as Time, value: d.value }))
            .filter(d => Number.isFinite(d.value));
          series.setData(lineData as any);
        }
      } else if (definition.renderConfig.hasBandFill && definition.renderConfig.fillBands) {
        const { upper: upperField, lower: lowerField } = definition.renderConfig.fillBands;

        const upperSeries = indicatorSeriesRef.current.get(`${indicator.id}-upper`);
        const middleSeries = indicatorSeriesRef.current.get(`${indicator.id}-middle`);
        const lowerSeries = indicatorSeriesRef.current.get(`${indicator.id}-lower`);

        if (upperSeries && middleSeries && lowerSeries) {
          const upperData = data.map(d => ({ time: d.time as Time, value: d[upperField] })).filter(d => !isNaN(d.value));
          const middleData = data.map(d => ({ time: d.time as Time, value: d.value })).filter(d => !isNaN(d.value));
          const lowerData = data.map(d => ({ time: d.time as Time, value: d[lowerField] })).filter(d => !isNaN(d.value));

          upperSeries.setData(upperData as any);
          middleSeries.setData(middleData as any);
          lowerSeries.setData(lowerData as any);
        }
      } else {
        // Generic multi-output indicator (mirrors the setup branch): refresh each
        // per-field series so MACD/Stochastic/etc. track lazily-loaded bars.
        outputFieldKeys(data[0]).forEach((key) => {
          const series = indicatorSeriesRef.current.get(`${indicator.id}-${key}`);
          if (!series) return;
          const points = data
            .map((d) => ({ time: d.time as Time, value: d[key] }))
            .filter((d) => Number.isFinite(d.value));
          series.setData(points as any);
        });
      }
    });
  }, [bars, indicators]);

  useEffect(() => {
    if (!seriesMarkersRef.current) return;
    // Win/loss markers track the theme's up/down candle colors.
    const tradeMarkers = buildTradeMarkers(trades, selectedTradeId, {
      win: resolvedTheme.upColor,
      loss: resolvedTheme.downColor,
    });
    const selectionMarker: SeriesMarker<Time>[] =
      enableBarSelection && selectedBar
        ? [
            {
              time: (selectedBar.timestamp / 1000) as Time,
              position: 'aboveBar' as const,
              color: resolvedTheme.crosshairColor,
              shape: 'circle' as const,
              text: '',
            },
          ]
        : [];
    const all = [...tradeMarkers, ...selectionMarker].sort(
      (a, b) => (a.time as number) - (b.time as number),
    );
    seriesMarkersRef.current.setMarkers(all);
  }, [trades, selectedTradeId, selectedBar, enableBarSelection, resolvedTheme]);

  useEffect(() => {
    if (!chartRef.current || !selectedBar || !enableBarSelection) {
      setSpotlightPosition(null);
      return;
    }

    const updateSpotlightPosition = () => {
      if (!chartRef.current || !selectedBar || !chartContainerRef.current) return;

      const timeScale = chartRef.current.timeScale();
      const barX = timeScale.timeToCoordinate((selectedBar.timestamp / 1000) as Time);

      if (barX !== null) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const barWidth = Math.max(8, rect.width / bars.length);
        setSpotlightPosition({ x: barX - barWidth / 2, width: barWidth });
      }
    };

    updateSpotlightPosition();

    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updateSpotlightPosition);

    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateSpotlightPosition);
      }
    };
  }, [selectedBar, enableBarSelection, bars.length]);

  // The popup follows the selected bar: it shows for the trade whose span
  // [entry, exit] contains the bar — so every bar of a trade shows it (anchored at
  // the bar), and a bar outside all trades shows none.
  const popupInfo = useMemo(() => {
    if (!selectedBar) return null;
    const ts = selectedBar.timestamp;
    const owner = trades.find((t) => ts >= t.entryTime && ts <= t.exitTime);
    return owner ? { trade: owner, time: ts } : null;
  }, [selectedBar, trades]);

  useEffect(() => {
    if (!chartRef.current || !popupInfo) {
      setTradePopupPos(null);
      return;
    }

    const updateTradePopupPos = () => {
      if (!chartRef.current || !popupInfo || !chartContainerRef.current) return;
      const timeScale = chartRef.current.timeScale();
      const x = timeScale.timeToCoordinate((popupInfo.time / 1000) as Time);
      // Hide when the bar is off-screen: timeToCoordinate returns null once it leaves the
      // logical range, but a bar just past the edge returns an out-of-bounds coordinate —
      // bound to [0, width] so the popup never peeks regardless of container overflow.
      const width = chartContainerRef.current.getBoundingClientRect().width;
      setTradePopupPos(x !== null && x >= 0 && x <= width ? { x } : null);
    };

    updateTradePopupPos();
    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updateTradePopupPos);
    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateTradePopupPos);
      }
    };
  }, [popupInfo]);

  const handleDeleteLine = (lineId: string) => {
    if (onDeleteLine) {
      onDeleteLine(lineId);
    }
  };

  const handleAddLineFromContext = (type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance') => {
    if (onAddLine && contextMenu) {
      onAddLine(type, contextMenu.price);
      setContextMenu(null);
    }
  };

  const handleClearAllLines = () => {
    if (onClearAllLines) {
      onClearAllLines();
      setContextMenu(null);
    }
  };

  return (
    <div className="relative space-y-4">
      {isLoadingMore && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-slate-200 px-4 py-2 rounded-lg shadow-lg z-10">
          Loading more data...
        </div>
      )}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />

        {bandRects.map((b) => (
          <div
            key={b.id}
            className="absolute left-0 right-0 pointer-events-none z-4"
            style={{ top: `${b.top}px`, height: `${b.height}px`, background: b.color }}
          />
        ))}

        {enableBarSelection && spotlightPosition && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-5"
            style={{
              left: `${spotlightPosition.x}px`,
              width: `${spotlightPosition.width}px`,
              background: 'rgba(59, 130, 246, 0.15)',
              borderLeft: '1px solid rgba(59, 130, 246, 0.4)',
              borderRight: '1px solid rgba(59, 130, 246, 0.4)',
            }}
          />
        )}

        {popupInfo && tradePopupPos && renderTradePopup && (
          <div
            className="absolute z-20 pointer-events-auto"
            style={{ left: `${tradePopupPos.x}px`, top: 8, transform: 'translateX(-50%)' }}
          >
            {renderTradePopup(popupInfo.trade)}
          </div>
        )}
      </div>

      {onDeleteLine && chartContainerRef.current && lines.map((line) => {
        const pos = linePositions.get(line.id);
        if (!pos) return null;

        return createPortal(
          <button
            key={line.id}
            onClick={() => handleDeleteLine(line.id)}
            className="bg-red-500/70 hover:bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors shadow-md"
            style={{
              position: 'fixed',
              top: `${pos.top - 8}px`,
              right: `${pos.right}px`,
              zIndex: 9999,
            }}
            title="Delete line"
          >
            ×
          </button>,
          document.body
        );
      })}

      {contextMenu && (
        <div
          className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-30 py-1 min-w-[180px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-600">
            Price: {contextMenu.price.toFixed(3)}
          </div>
          <button
            onClick={() => handleAddLineFromContext('entry')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Entry Line
          </button>
          <button
            onClick={() => handleAddLineFromContext('stopLoss')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Stop Loss
          </button>
          <button
            onClick={() => handleAddLineFromContext('takeProfit')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Take Profit
          </button>
          <div className="border-t border-slate-600 my-1"></div>
          <button
            onClick={() => handleAddLineFromContext('support')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Support Line
          </button>
          <button
            onClick={() => handleAddLineFromContext('resistance')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Resistance Line
          </button>
          <div className="border-t border-slate-600 my-1"></div>
          <button
            onClick={handleClearAllLines}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors"
          >
            Clear All Lines
          </button>
        </div>
      )}
    </div>
  );
}

// A price line with a `title` renders a title box to the LEFT of its on-axis
// price value, overhanging into the plot. The floating delete button is placed
// just left of the value box, so without this allowance it lands on top of the
// title text. Reserve an approximate title-box width (canvas labels can't be
// measured) so the button clears the label.
function estimateLabelTitleWidth(title?: string): number {
  if (!title) return 0;
  return title.length * 7 + 18;
}

function getLineStyle(style?: 'solid' | 'dashed' | 'dotted'): LineStyle {
  switch (style) {
    case 'dashed':
      return LineStyle.Dashed;
    case 'dotted':
      return LineStyle.Dotted;
    default:
      return LineStyle.Solid;
  }
}

// Axis tick labels in `timeZone` (undefined = the viewer's local timezone).
// `tickMarkType`: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds.
function makeTickMarkFormatter(timeZone?: string) {
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const timeSec = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const month = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short' });
  const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });
  const year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' });
  return (t: Time, tickMarkType: number): string => {
    const d = new Date((t as number) * 1000);
    switch (tickMarkType) {
      case 0:
        return year.format(d);
      case 1:
        return month.format(d);
      case 2:
        return day.format(d);
      case 4:
        return timeSec.format(d);
      default:
        return time.format(d);
    }
  };
}

// Crosshair time label in `timeZone` (undefined = the viewer's local timezone).
function makeCrosshairTimeFormatter(timeZone?: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return (t: Time): string => fmt.format(new Date((t as number) * 1000));
}
