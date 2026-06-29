import { useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { OHLCVBar, ChartTheme } from '../../types/chart';
import { buildBaseChartLayoutOptions } from '../../utils/chartTheme';
import {
  BAR_CLICK_TIME_TOLERANCE_SEC,
  DRAG_THRESHOLD_PX,
  MIN_SPOTLIGHT_WIDTH,
} from '../chart-constants';

interface UseChartLifecycleArgs {
  // DOM + chart object refs (created in the component, assigned here).
  chartContainerRef: RefObject<HTMLDivElement>;
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  volumeSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>;
  seriesMarkersRef: MutableRefObject<any>;
  // Shared refs cleared on teardown (also owned by the bars-sync / indicator hooks).
  indicatorSeriesRef: MutableRefObject<Map<string, ISeriesApi<any>>>;
  indicatorPaneIndexRef: MutableRefObject<Map<string, number>>;
  nextPaneIndexRef: MutableRefObject<number>;
  previousBarsRef: MutableRefObject<OHLCVBar[]>;
  previousBarsLengthRef: MutableRefObject<number>;
  // Live data refs read inside the create-once closures.
  isLoadingRef: MutableRefObject<boolean>;
  barsRef: MutableRefObject<OHLCVBar[]>;
  selectedBarRef: MutableRefObject<OHLCVBar | null>;
  heightRef: MutableRefObject<number | undefined>;
  themeRef: MutableRefObject<ChartTheme>;
  // Create-time prop values (captured on mount, matching the original [] effect).
  height?: number;
  timeZone?: string;
  onLoadMoreData?: (oldestTimestamp: number) => void;
  enableBarSelection: boolean;
  barSelectionControlled: boolean;
  onBarClick?: (bar: OHLCVBar | null) => void;
  lineEditEnabled: boolean;
  // Volume pane sizing (shared with the height-apply effect).
  sizeVolumePane: () => void;
  // State setters.
  setIsLoadingMore: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; price: number } | null>>;
  setSelectedBar: Dispatch<SetStateAction<OHLCVBar | null>>;
  setSpotlightPosition: Dispatch<SetStateAction<{ x: number; width: number } | null>>;
}

/**
 * Create-once chart lifecycle: builds the chart + candlestick/volume series,
 * installs the load-more subscription, ResizeObserver, and the five DOM
 * listeners (contextmenu/mousedown/mousemove/mouseup/click), and tears all of it
 * down on unmount — resetting the series + bars-diff refs shared with the
 * bars-sync / indicator hooks (load-bearing for React StrictMode's double-mount).
 *
 * MUST be called FIRST among the chart effects so the chart exists before the
 * sibling effects (bars→setData, indicators, framing, …) run.
 */
export function useChartLifecycle({
  chartContainerRef,
  chartRef,
  candlestickSeriesRef,
  volumeSeriesRef,
  seriesMarkersRef,
  indicatorSeriesRef,
  indicatorPaneIndexRef,
  nextPaneIndexRef,
  previousBarsRef,
  previousBarsLengthRef,
  isLoadingRef,
  barsRef,
  selectedBarRef,
  heightRef,
  themeRef,
  height,
  timeZone,
  onLoadMoreData,
  enableBarSelection,
  barSelectionControlled,
  onBarClick,
  lineEditEnabled,
  sizeVolumePane,
  setIsLoadingMore,
  setContextMenu,
  setSelectedBar,
  setSpotlightPosition,
}: UseChartLifecycleArgs) {
  // Drag tracking is private to the click vs. drag discrimination below.
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  // Bar selection is "controlled" when `selectedBarTime` is passed — the click
  // handler then only notifies (via onBarClick) and lets the prop drive the
  // highlight. Read via ref inside the create-once click closure.
  const barSelectionControlledRef = useRef(barSelectionControlled);
  barSelectionControlledRef.current = barSelectionControlled;
  // Line-editing is opt-in: the right-click "add line" menu only opens when a
  // consumer wires the add/clear handlers. Read via ref from the create-once
  // contextmenu closure without going stale.
  const lineEditEnabledRef = useRef(lineEditEnabled);
  lineEditEnabledRef.current = lineEditEnabled;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartContainerRef.current.style.position = 'relative';

    const t = themeRef.current;
    const base = buildBaseChartLayoutOptions(t);
    const chart = createChart(chartContainerRef.current, {
      ...base,
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
        ...base.timeScale,
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: makeTickMarkFormatter(timeZone),
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
        if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
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
        return diff < BAR_CLICK_TIME_TOLERANCE_SEC;
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
            const barWidth = Math.max(MIN_SPOTLIGHT_WIDTH, rect.width / barsRef.current.length);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
