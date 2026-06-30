import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IChartApi, IPriceLine, ISeriesApi, Time } from 'lightweight-charts';
import { OHLCVBar, ChartLine, ChartTrade, PriceBand, ChartTheme } from '../types/chart';
import { DEFAULT_CHART_THEME, buildBaseChartLayoutOptions } from '../utils/chartTheme';
import { IndicatorInstance } from '../indicators/core/types';
import { MIN_VOLUME_PANE_HEIGHT, VOLUME_PANE_FRACTION } from './chart-constants';
import { useChartLifecycle } from './chart-hooks/useChartLifecycle';
import { useTradeFocus } from './chart-hooks/useTradeFocus';
import { useBarsSync } from './chart-hooks/useBarsSync';
import { usePriceLines } from './chart-hooks/usePriceLines';
import { usePriceBands } from './chart-hooks/usePriceBands';
import { useIndicatorSeries } from './chart-hooks/useIndicatorSeries';
import { useTradeMarkers } from './chart-hooks/useTradeMarkers';
import { useSpotlight } from './chart-hooks/useSpotlight';
import { usePopupPosition } from './chart-hooks/usePopupPosition';
import { useSessions } from './chart-hooks/useSessions';
import { US_EQUITY_PRESET, type SessionsConfig } from '../sessions/sessions';
import { useOhlcLegend } from './chart-hooks/useOhlcLegend';
import OhlcLegend from './OhlcLegend';
import type { OhlcLegendData } from './ohlcLegendData';
import LineSettingsDialog from './LineSettingsDialog';

/** An item in the chart's right-click context menu (see `contextMenuItems`). */
export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  /** Render in a destructive style (e.g. a "Clear all" action). */
  danger?: boolean;
}

interface ChartComponentProps {
  bars: OHLCVBar[];
  onLoadMoreData?: (oldestTimestamp: number) => void;
  indicators?: IndicatorInstance[];
  lines?: ChartLine[];
  onDeleteLine?: (lineId: string) => void;
  onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance', price: number) => void;
  onClearAllLines?: () => void;
  /**
   * Drag a price line to reprice it. Fired (with the new price) when the drag is
   * released — the host should update the line's `price` in `lines` to persist it.
   * Wiring this makes every line draggable except those with `draggable: false`.
   */
  onLineMove?: (lineId: string, price: number) => void;
  /**
   * Double-click a price line to edit it. Opens the built-in `LineSettingsDialog`
   * (label/color/style/width); this fires with the edited line on save — the host
   * should merge it into `lines`. Wiring this makes every line editable except
   * those with `editable: false`.
   */
  onLineChange?: (line: ChartLine) => void;
  /**
   * Customize the right-click menu items. Receives the clicked `price`; return the
   * items to show. When provided, this replaces the built-in (entry/stop/take-profit/
   * support/resistance + clear) menu — letting a host show e.g. a single
   * "Add horizontal line" and own the line styling. The menu still appears only when
   * the menu would otherwise be enabled (an `onAddLine`/`onClearAllLines`/this prop).
   */
  contextMenuItems?: (args: { price: number }) => ContextMenuItem[];
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
   * Session shading + day separators. `true` uses the US-equity preset (pre-market /
   * after-hours dimmed, RTH clear, in ET); pass a {@link SessionsConfig} for custom
   * sessions/timezone/colors; omit or `false` to disable. Memoize a config object so
   * the live primitive isn't needlessly re-applied each render.
   */
  sessions?: SessionsConfig | boolean;
  /**
   * Show the crosshair OHLC legend (O/H/L/C/V + change% + active indicator values,
   * following the cursor; idle shows the last bar). Default false. Style it yourself
   * with `renderOhlcLegend`.
   */
  showOhlcLegend?: boolean;
  /** Custom renderer for the crosshair OHLC legend (overrides the built-in default). */
  renderOhlcLegend?: (data: OhlcLegendData) => ReactNode;
  /**
   * Visual theme for the chart canvas (background, grid, axes, candles, volume).
   * A partial override of {@link DEFAULT_CHART_THEME}; re-applied live on change.
   */
  theme?: Partial<ChartTheme>;
}

export default function ChartComponent({
  bars,
  onLoadMoreData,
  indicators = [],
  lines = [],
  onDeleteLine,
  onAddLine,
  onClearAllLines,
  onLineMove,
  onLineChange,
  contextMenuItems,
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
  sessions = false,
  showOhlcLegend = false,
  renderOhlcLegend,
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

  // DOM + chart object refs.
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const seriesMarkersRef = useRef<any>(null);
  // Shared with the price-lines hook (which populates it) + the lifecycle hook's
  // drag handler (which mutates a line's price live during a drag).
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map());
  // Shared with the indicator hook + reset by the create-once teardown.
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const indicatorPaneIndexRef = useRef<Map<string, number>>(new Map());
  const nextPaneIndexRef = useRef<number>(2);
  // Shared with the bars-sync hook + reset by the create-once teardown.
  const previousBarsRef = useRef<OHLCVBar[]>([]);
  const previousBarsLengthRef = useRef<number>(0);
  // Live data refs read inside non-reactive closures.
  const isLoadingRef = useRef(false);
  const barsRef = useRef<OHLCVBar[]>(bars);
  const selectedBarRef = useRef<OHLCVBar | null>(null);
  // Latest explicit height (px) or undefined for auto-fill; read inside the
  // create-once effect's resize closure without going stale.
  const heightRef = useRef<number | undefined>(height);
  heightRef.current = height;
  // Interactive-line state read inside the create-once lifecycle handlers via refs.
  const linesRef = useRef<ChartLine[]>(lines);
  linesRef.current = lines;
  const onLineMoveRef = useRef(onLineMove);
  onLineMoveRef.current = onLineMove;
  const onLineChangeRef = useRef(onLineChange);
  onLineChangeRef.current = onLineChange;

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);
  const [spotlightPosition, setSpotlightPosition] = useState<{ x: number; width: number } | null>(null);
  const [tradePopupPos, setTradePopupPos] = useState<{ x: number } | null>(null);
  // The line being edited (double-click → LineSettingsDialog), and the line
  // currently being dragged (whose delete button is hidden until release).
  const [editingLine, setEditingLine] = useState<ChartLine | null>(null);
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);

  // Bar selection is "controlled" when `selectedBarTime` is passed — the click
  // handler then only notifies (via onBarClick) and lets the prop drive the
  // highlight.
  const barSelectionControlled = selectedBarTime !== undefined;
  // Line-editing is opt-in: the right-click "add line" menu only opens when a
  // consumer wires the add/clear handlers. (Delete buttons gate on `onDeleteLine`
  // directly at render.)
  const lineEditEnabled = Boolean(onAddLine || onClearAllLines || contextMenuItems);

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
    panes[1].setHeight(Math.max(MIN_VOLUME_PANE_HEIGHT, Math.round(totalH * VOLUME_PANE_FRACTION)));
  }, []);

  // [effect 1] Controlled bar selection: mirror `selectedBarTime` into selectedBar
  // (the spotlight + selection marker follow it).
  useEffect(() => {
    if (!barSelectionControlled) return;
    const bar =
      selectedBarTime == null
        ? null
        : barsRef.current.find((b) => b.timestamp === selectedBarTime) ?? null;
    selectedBarRef.current = bar;
    setSelectedBar(bar);
  }, [selectedBarTime, barSelectionControlled, bars]);

  // [effect 2] Create-once chart lifecycle (must run before the sibling effects).
  useChartLifecycle({
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
  });

  // [effect 3] Keep the live bars ref current for the non-reactive closures.
  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  // [effect 4] Apply an explicit `height` prop change (the create-once effect
  // can't), and re-apply the volume pane's fractional size against the new total.
  useEffect(() => {
    if (chartRef.current && height !== undefined) {
      chartRef.current.applyOptions({ height });
      sizeVolumePane();
    }
  }, [height, sizeVolumePane]);

  // [effect 5] Re-theme the existing chart live when `theme` changes (e.g. a host
  // app's dark/light toggle) — no recreate. Candle colors are series options;
  // volume bar colors live in the data, so they're re-set from the current bars.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions(buildBaseChartLayoutOptions(resolvedTheme));
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

  // [effect 6] Frame a focused trade into view.
  useTradeFocus({ chartRef, candlestickSeriesRef, bars, trades, focusTradeId });

  // [effect 7] Sync bars into the candlestick + volume series.
  useBarsSync({
    candlestickSeriesRef,
    volumeSeriesRef,
    themeRef,
    isLoadingRef,
    previousBarsRef,
    previousBarsLengthRef,
    setIsLoadingMore,
    bars,
  });

  // [effects 8 + 9] Price lines + floating delete-button positions.
  const linePositions = usePriceLines({ chartRef, candlestickSeriesRef, chartContainerRef, lines, priceLineRefs });

  // [effect 10] Shaded price bands.
  const bandRects = usePriceBands({ chartRef, candlestickSeriesRef, priceBands });

  // [effects 10a + 10b] Session shading + day separators (custom canvas primitive).
  const resolvedSessions = useMemo<SessionsConfig | null>(
    () => (sessions === true ? US_EQUITY_PRESET : sessions ? sessions : null),
    [sessions],
  );
  useSessions({ candlestickSeriesRef, config: resolvedSessions });

  // [effect 10c] Crosshair OHLC legend (O/H/L/C/V + indicator values; idle = last bar).
  const ohlcLegendEnabled = showOhlcLegend || renderOhlcLegend != null;
  const ohlcLegend = useOhlcLegend({
    enabled: ohlcLegendEnabled,
    chartRef,
    candlestickSeriesRef,
    volumeSeriesRef,
    indicatorSeriesRef,
    barsRef,
    selectedBar,
    bars,
    indicators,
  });

  // [effects 11 + 12] Indicator series setup + data refresh.
  useIndicatorSeries({
    chartRef,
    barsRef,
    indicatorSeriesRef,
    indicatorPaneIndexRef,
    nextPaneIndexRef,
    indicators,
    bars,
  });

  // [effect 13] Trade + selection markers.
  useTradeMarkers({
    seriesMarkersRef,
    trades,
    selectedTradeId,
    selectedBar,
    enableBarSelection,
    resolvedTheme,
  });

  // [effect 14] Selected-bar spotlight overlay position.
  useSpotlight({
    chartRef,
    chartContainerRef,
    selectedBar,
    enableBarSelection,
    bars,
    setSpotlightPosition,
  });

  // The popup follows the selected bar: it shows for the trade whose span
  // [entry, exit] contains the bar — so every bar of a trade shows it (anchored at
  // the bar), and a bar outside all trades shows none.
  const popupInfo = useMemo(() => {
    if (!selectedBar) return null;
    const ts = selectedBar.timestamp;
    const owner = trades.find((t) => ts >= t.entryTime && ts <= t.exitTime);
    return owner ? { trade: owner, time: ts } : null;
  }, [selectedBar, trades]);

  // [effect 15] Trade popup anchor position.
  usePopupPosition({ chartRef, chartContainerRef, popupInfo, setTradePopupPos });

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

        {ohlcLegend && (
          <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 6, pointerEvents: 'none' }}>
            {renderOhlcLegend ? (
              renderOhlcLegend(ohlcLegend)
            ) : (
              <OhlcLegend data={ohlcLegend} theme={resolvedTheme} timeZone={timeZone} />
            )}
          </div>
        )}

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
        if (line.deletable === false) return null; // read-only line (e.g. a trade overlay)
        if (line.id === draggingLineId) return null; // mid-drag: host price is stale; reappears on release
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
          className="absolute z-30 min-w-[180px] rounded-[var(--ck-radius,0.5rem)] border border-[var(--ck-border,#334155)] bg-[var(--ck-surface,#1e293b)] py-1 shadow-xl"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            fontFamily: 'var(--ck-font, inherit)',
          }}
        >
          <div className="border-b border-[var(--ck-border,#334155)] px-3 py-1 text-xs text-[var(--ck-text-muted,#94a3b8)]">
            Price: {contextMenu.price.toFixed(3)}
          </div>
          {contextMenuItems ? (
            // Host-defined items.
            contextMenuItems({ price: contextMenu.price }).map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  item.onSelect();
                  setContextMenu(null);
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--ck-surface-hover,#475569)] ${
                  item.danger ? 'text-red-400' : 'text-[var(--ck-text,#f1f5f9)]'
                }`}
              >
                {item.label}
              </button>
            ))
          ) : (
            // Built-in default menu.
            <>
              <button
                onClick={() => handleAddLineFromContext('entry')}
                className="w-full px-3 py-2 text-left text-sm text-[var(--ck-text,#f1f5f9)] hover:bg-[var(--ck-surface-hover,#475569)] transition-colors"
              >
                Add Entry Line
              </button>
              <button
                onClick={() => handleAddLineFromContext('stopLoss')}
                className="w-full px-3 py-2 text-left text-sm text-[var(--ck-text,#f1f5f9)] hover:bg-[var(--ck-surface-hover,#475569)] transition-colors"
              >
                Add Stop Loss
              </button>
              <button
                onClick={() => handleAddLineFromContext('takeProfit')}
                className="w-full px-3 py-2 text-left text-sm text-[var(--ck-text,#f1f5f9)] hover:bg-[var(--ck-surface-hover,#475569)] transition-colors"
              >
                Add Take Profit
              </button>
              <div className="border-t border-[var(--ck-border,#334155)] my-1"></div>
              <button
                onClick={() => handleAddLineFromContext('support')}
                className="w-full px-3 py-2 text-left text-sm text-[var(--ck-text,#f1f5f9)] hover:bg-[var(--ck-surface-hover,#475569)] transition-colors"
              >
                Add Support Line
              </button>
              <button
                onClick={() => handleAddLineFromContext('resistance')}
                className="w-full px-3 py-2 text-left text-sm text-[var(--ck-text,#f1f5f9)] hover:bg-[var(--ck-surface-hover,#475569)] transition-colors"
              >
                Add Resistance Line
              </button>
              <div className="border-t border-[var(--ck-border,#334155)] my-1"></div>
              <button
                onClick={handleClearAllLines}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[var(--ck-surface-hover,#475569)] transition-colors"
              >
                Clear All Lines
              </button>
            </>
          )}
        </div>
      )}

      <LineSettingsDialog
        isOpen={editingLine !== null}
        line={editingLine}
        title="Edit Line"
        onClose={() => setEditingLine(null)}
        onSave={(line) => {
          onLineChange?.(line);
          setEditingLine(null);
        }}
      />
    </div>
  );
}
