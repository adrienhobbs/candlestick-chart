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
import { OHLCVBar, ChartLine, ChartTheme } from '../../types/chart';
import { buildBaseChartLayoutOptions } from '../../utils/chartTheme';
import { nearestLineWithin } from '../../utils/nearestLine';
import {
  BAR_CLICK_TIME_TOLERANCE_SEC,
  DRAG_THRESHOLD_PX,
  LINE_HIT_THRESHOLD_PX,
  MIN_SPOTLIGHT_WIDTH,
} from '../chart-constants';
import type { IPriceLine } from 'lightweight-charts';

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
  // Interactive price lines (drag-to-reprice + double-click-to-edit).
  // Shared live `IPriceLine` map (populated by usePriceLines; mutated here mid-drag).
  priceLineRefs: MutableRefObject<Map<string, IPriceLine>>;
  // Latest `lines`, `onLineMove`, `onLineChange` read via refs inside the
  // create-once handlers without going stale.
  linesRef: MutableRefObject<ChartLine[]>;
  onLineMoveRef: MutableRefObject<((id: string, price: number) => void) | undefined>;
  onLineChangeRef: MutableRefObject<((line: ChartLine) => void) | undefined>;
  // Volume pane sizing (shared with the height-apply effect).
  sizeVolumePane: () => void;
  // State setters.
  setIsLoadingMore: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; price: number } | null>>;
  setSelectedBar: Dispatch<SetStateAction<OHLCVBar | null>>;
  setSpotlightPosition: Dispatch<SetStateAction<{ x: number; width: number } | null>>;
  // Open the edit dialog for a double-clicked line; hide the dragged line's
  // delete button while it's mid-drag (its host price is stale until release).
  setEditingLine: Dispatch<SetStateAction<ChartLine | null>>;
  setDraggingLineId: Dispatch<SetStateAction<string | null>>;
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
  priceLineRefs,
  linesRef,
  onLineMoveRef,
  onLineChangeRef,
  sizeVolumePane,
  setIsLoadingMore,
  setContextMenu,
  setSelectedBar,
  setSpotlightPosition,
  setEditingLine,
  setDraggingLineId,
}: UseChartLifecycleArgs) {
  // Drag tracking is private to the click vs. drag discrimination below.
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  // Active line-drag state (null = not dragging a line). `lastGoodPrice` retains
  // the last in-scale price so an off-scale flick never repositions the line to a
  // null coordinate; `moved` gates the `onLineMove` fire (a no-move grab — e.g.
  // the down-strokes of a double-click — must not reprice).
  const lineDragRef = useRef<{ id: string; lastGoodPrice: number; moved: boolean } | null>(null);
  // Set on a line-drag mouseup so the subsequent synthetic 'click' doesn't fall
  // through to bar-selection (covers the sub-threshold grab the 5px drag guard misses).
  const suppressClickRef = useRef(false);
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

    // Project a line's price to a container-relative y (null = off-scale/no series).
    const projectPrice = (price: number) =>
      candlestickSeriesRef.current?.priceToCoordinate(price) ?? null;

    // End an in-progress line-drag: restore pan/zoom, drop the drag, suppress the
    // trailing click, and (when `fire`) notify the host of the new price.
    const endLineDrag = (fire: boolean) => {
      const drag = lineDragRef.current;
      lineDragRef.current = null;
      chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
      setDraggingLineId(null);
      suppressClickRef.current = true;
      if (fire && drag && drag.moved) {
        onLineMoveRef.current?.(drag.id, drag.lastGoodPrice);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;

      // Begin a line-drag if the press lands on a draggable line. Capture-phase on
      // the container runs before lightweight-charts' canvas handler, so freezing
      // pan/zoom here stops the chart from scrolling under the drag.
      if (!onLineMoveRef.current || !candlestickSeriesRef.current || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const draggable = linesRef.current.filter((l) => l.draggable !== false);
      const hitId = nearestLineWithin(y, draggable, projectPrice, LINE_HIT_THRESHOLD_PX);
      const hit = hitId ? linesRef.current.find((l) => l.id === hitId) : undefined;
      if (!hit) return;
      lineDragRef.current = { id: hit.id, lastGoodPrice: hit.price, moved: false };
      setDraggingLineId(hit.id);
      chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Active line-drag: move the line live via applyOptions. `moved` only flips
      // once travel exceeds the drag threshold, so a (near-stationary) double-click
      // never repositions the line or fires onLineMove.
      const drag = lineDragRef.current;
      if (drag) {
        const series = candlestickSeriesRef.current;
        const container = chartContainerRef.current;
        if (!series || !container) return;
        const priceLine = priceLineRefs.current.get(drag.id);
        if (!priceLine) {
          // Host recreated/removed the line mid-drag — abort cleanly.
          endLineDrag(false);
          return;
        }
        const rect = container.getBoundingClientRect();
        const clampedY = Math.max(0, Math.min(container.offsetHeight, e.clientY - rect.top));
        const price = series.coordinateToPrice(clampedY);
        if (price !== null) {
          drag.lastGoodPrice = price as number;
          const start = mouseDownPosRef.current;
          const travel = start
            ? Math.max(Math.abs(e.clientX - start.x), Math.abs(e.clientY - start.y))
            : Infinity;
          if (travel > DRAG_THRESHOLD_PX) drag.moved = true;
          priceLine.applyOptions({ price: price as number });
        }
        return;
      }

      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
          isDraggingRef.current = true;
        }
      }

      // Cursor affordance: ns-resize while hovering a draggable line (not dragging).
      if (onLineMoveRef.current && candlestickSeriesRef.current && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const draggable = linesRef.current.filter((l) => l.draggable !== false);
        const overLine = nearestLineWithin(e.clientY - rect.top, draggable, projectPrice, LINE_HIT_THRESHOLD_PX);
        chartContainerRef.current.style.cursor = overLine ? 'ns-resize' : '';
      }
    };

    const handleMouseUp = () => {
      if (lineDragRef.current) {
        endLineDrag(true);
      }
      mouseDownPosRef.current = null;
    };

    // Double-click a line → open the edit dialog (gated on `onLineChange`).
    const handleDoubleClick = (e: MouseEvent) => {
      if (!onLineChangeRef.current || !candlestickSeriesRef.current || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const editable = linesRef.current.filter((l) => l.editable !== false);
      const hitId = nearestLineWithin(y, editable, projectPrice, LINE_HIT_THRESHOLD_PX);
      const hit = hitId ? linesRef.current.find((l) => l.id === hitId) : undefined;
      if (hit) setEditingLine(hit);
    };

    const handleClick = (e: MouseEvent) => {
      setContextMenu(null);

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        return;
      }

      // Swallow the click that trails a line-drag (covers the sub-threshold grab
      // the 5px isDragging guard misses), so it doesn't toggle bar-selection.
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
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
    chartContainerRef.current.addEventListener('dblclick', handleDoubleClick, true);

    const container = chartContainerRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      container.removeEventListener('contextmenu', handleContextMenu, true);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mousemove', handleMouseMove, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('click', handleClick, true);
      container.removeEventListener('dblclick', handleDoubleClick, true);
      // Unmounting mid-drag would otherwise leave the chart frozen; the chart is
      // about to be removed, but reset the drag state for safety.
      lineDragRef.current = null;
      suppressClickRef.current = false;
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
