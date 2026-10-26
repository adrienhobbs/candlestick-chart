import { useState, useMemo, useCallback } from 'react';
import { TrendingUp, Settings, Plus, Trash2, RefreshCw, Crosshair } from 'lucide-react';
// Dogfood the public package surface: the dev harness imports candlekit from its
// published barrel (`./index`) rather than deep relative paths.
import {
  ChartComponent,
  SettingsDialog,
  IndicatorBrowser,
  LineChart,
  useBarsData,
  AlpacaBarAdapter,
  MockAdapter,
  registerBuiltInIndicators,
  createPersistenceAdapter,
} from './index';
import type {
  OHLCVBar,
  ChartTrade,
  ChartLine,
  ChartMarker,
  ChartSignpost,
  ChartRailMarker,
  IndicatorInstance,
  LineChartSeries,
  VolumeMode,
} from './index';
// NOTE: ChartAPIProvider / useChartAPIContext are NOT part of the public barrel
// (`./index`), so they must still be imported from the context module directly.
import { ChartAPIProvider, useChartAPIContext } from './contexts/ChartAPIContext';

registerBuiltInIndicators();

const USE_ALPACA = !!(import.meta.env.VITE_ALPACA_API_KEY && import.meta.env.VITE_ALPACA_SECRET_KEY);

// The demo keeps its own indicator set rather than the shared default key.
const persistenceAdapter = createPersistenceAdapter('localStorage', { key: 'candlekit-demo.indicators' });

const WIN = '#22c55e';
const LOSS = '#ef4444';

type TradeMarkStyle = 'price' | 'arrows';

function AppContent() {
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorInstance | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [focusTradeId, setFocusTradeId] = useState<string | null>(null);
  const [markStyle, setMarkStyle] = useState<TradeMarkStyle>('price');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('pane');
  const [symbol] = useState('AAPL');
  const [timeframe] = useState('5Min');

  const dataAdapter = useMemo(() => {
    if (USE_ALPACA) {
      return new AlpacaBarAdapter({
        apiKey: import.meta.env.VITE_ALPACA_API_KEY,
        secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
        baseUrl: import.meta.env.VITE_ALPACA_BASE_URL,
        wsUrl: import.meta.env.VITE_ALPACA_WS_URL,
      });
    }
    return new MockAdapter();
  }, []);

  const {
    lines,
    indicators,
    addLine,
    addEntryLine,
    addStopLoss,
    addTakeProfit,
    removeLine,
    updateLine,
    clearAllLines,
    addLineByType,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings,
  } = useChartAPIContext();

  // Hovered trade (from the chart's onHoverBar) → preview its bounded overlays.
  const [hoveredTradeId, setHoveredTradeId] = useState<string | null>(null);

  // Double-click a user line → edit dialog. Replace it (same id) with the edits.
  const handleLineChange = useCallback(
    (line: ChartLine) => {
      removeLine(line.id);
      addLine(line.id, line.price, {
        color: line.color,
        lineWidth: line.lineWidth,
        lineStyle: line.lineStyle,
        title: line.title,
      });
    },
    [removeLine, addLine],
  );

  const {
    bars,
    loading,
    error,
    connected,
    fetchHistorical,
    subscribe,
    unsubscribe,
  } = useBarsData({
    adapter: dataAdapter,
    symbol,
    timeframe,
    autoFetch: true,
    autoSubscribe: false,
    limit: 500,
  });

  const handleLoadMoreData = useCallback(async (oldestTimestamp: number) => {
    await fetchHistorical({
      before: oldestTimestamp,
      limit: 100,
    });
  }, [fetchHistorical]);

  const handleSettingsSave = (indicatorId: string, settings: Record<string, unknown>) => {
    updateIndicatorSettings(indicatorId, settings);
    setIsSettingsOpen(false);
    setSelectedIndicator(null);
  };

  const lastClose = bars.length > 0 ? bars[bars.length - 1].close : null;

  // --- Trades ----------------------------------------------------------------
  // Derive demo trades FROM loaded bars so entry/exit timestamps exactly match
  // real bar timestamps (MockAdapter uses dynamic Date.now()-based spacing).
  // Placed over the newest 500 bars, so scrolling back (which prepends bars) keeps
  // them on the same bars.
  const demoTrades = useMemo<ChartTrade[]>(() => {
    if (bars.length < 60) return [];
    const base = Math.max(0, bars.length - 500);
    const n = bars.length - base;
    const at = (frac: number) => base + Math.min(n - 1, Math.max(0, Math.round(frac * n)));
    const mk = (id: string, from: number, to: number, outcome: 'win' | 'loss'): ChartTrade => {
      const ei = at(from);
      const xi = at(to);
      return {
        id,
        entryTime: bars[ei].timestamp,
        exitTime: bars[xi].timestamp,
        entryPrice: bars[ei].close,
        exitPrice: bars[xi].close,
        outcome,
        markerStyle: markStyle,
      };
    };
    return [
      mk('t1', 0.06, 0.12, 'win'),
      mk('t2', 0.24, 0.3, 'loss'),
      mk('t3', 0.44, 0.52, 'win'),
      // A context trade (e.g. refused / counterfactual): drawn faded.
      { ...mk('t4', 0.64, 0.7, 'loss'), muted: true },
      mk('t5', 0.82, 0.9, 'win'),
    ];
  }, [bars, markStyle]);

  // Show a trade's overlays for the hovered trade (preview) else the selected one.
  const displayedTradeId = hoveredTradeId ?? selectedTradeId;

  // onHoverBar → the trade whose [entry, exit] window contains the hovered bar.
  const handleHoverBar = useCallback(
    (tMs: number | null) => {
      const id =
        tMs == null
          ? null
          : demoTrades.find((t) => tMs >= t.entryTime && tMs <= t.exitTime)?.id ?? null;
      setHoveredTradeId((prev) => (prev === id ? prev : id));
    },
    [demoTrades],
  );

  // Time-bounded trade overlays (entry/stop/target segments + a labeled MFE↔MAE box)
  // anchored to the displayed trade's window — so they auto-hide when scrolled away.
  const { tradeLines, tradeBands, tradeMarkers, tradeSignposts } = useMemo(() => {
    const trade = demoTrades.find((t) => t.id === displayedTradeId);
    if (!trade || bars.length === 0) {
      return {
        tradeLines: [] as ChartLine[],
        tradeBands: [],
        tradeMarkers: [] as ChartMarker[],
        tradeSignposts: [] as ChartSignpost[],
      };
    }
    const PAD = 2;
    const ei = Math.max(0, bars.findIndex((b) => b.timestamp === trade.entryTime));
    const found = bars.findIndex((b) => b.timestamp === trade.exitTime);
    const xi = found < 0 ? bars.length - 1 : found;
    const startTime = bars[Math.max(0, ei - PAD)].timestamp;
    const endTime = bars[Math.min(bars.length - 1, xi + PAD)].timestamp;
    const entry = trade.entryPrice;
    const stop = entry * 0.985;
    const target = entry * 1.03;
    const span = bars.slice(ei, xi + 1);
    const mfe = Math.max(...span.map((b) => b.high));
    const mae = Math.min(...span.map((b) => b.low));
    const mfeBar = span.find((b) => b.high === mfe) ?? bars[ei];
    const maeBar = span.find((b) => b.low === mae) ?? bars[ei];
    const risk = entry - stop;
    const fmtR = (r: number) => `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`;
    // Read-only + time-bounded → drawn as segments that hide when scrolled off.
    const ro = { deletable: false, draggable: false, editable: false, startTime, endTime } as const;
    // A counterfactual exit two bars before the real one, drawn hollow.
    const virtualExit = bars[Math.max(ei, xi - 2)];
    return {
      tradeLines: [
        { id: 'trade-entry', price: entry, color: '#9ca3af', lineStyle: 'solid', title: 'Entry', type: 'entry', ...ro },
        { id: 'trade-stop', price: stop, color: LOSS, lineStyle: 'dashed', title: 'Stop', type: 'stopLoss', ...ro },
        { id: 'trade-target', price: target, color: WIN, lineStyle: 'dashed', title: 'Target', type: 'takeProfit', ...ro },
      ] as ChartLine[],
      tradeBands: [
        {
          id: 'trade-mfemae',
          top: mfe,
          bottom: mae,
          color: 'rgba(59,130,246,0.12)',
          startTime,
          endTime,
          topLabel: fmtR((mfe - entry) / risk),
          bottomLabel: fmtR((mae - entry) / risk),
          topLabelColor: WIN,
          bottomLabelColor: LOSS,
        },
      ],
      tradeMarkers: [
        { id: 'mfe', time: mfeBar.timestamp, price: mfe, color: WIN, text: 'MFE' },
        { id: 'mae', time: maeBar.timestamp, price: mae, color: LOSS, shape: 'square', text: 'MAE' },
        {
          id: 'virtual-exit',
          time: virtualExit.timestamp,
          price: virtualExit.close,
          color: '#a855f7',
          shape: 'arrowLeft',
          hollow: true,
        },
      ] as ChartMarker[],
      tradeSignposts: [
        { id: 'sp-entry', time: trade.entryTime, label: `ENTRY ${entry.toFixed(2)}`, color: '#64748b' },
        {
          id: 'sp-exit',
          time: trade.exitTime,
          label: `EXIT ${trade.exitPrice.toFixed(2)}`,
          color: trade.outcome === 'win' ? WIN : LOSS,
        },
      ] as ChartSignpost[],
    };
  }, [displayedTradeId, demoTrades, bars]);

  // Event rail: one mark per trade entry (numbered) plus a "timer would have fired"
  // diamond inside each trade — events with a time but no price.
  const railMarkers = useMemo<ChartRailMarker[]>(() => {
    if (!showAnnotations) return [];
    return demoTrades.flatMap((t, i) => [
      {
        id: `rail-entry-${t.id}`,
        time: t.entryTime,
        color: t.outcome === 'win' ? WIN : LOSS,
        shape: 'circle' as const,
        hollow: t.muted,
        label: String(i + 1),
      },
      {
        id: `rail-timer-${t.id}`,
        time: Math.round((t.entryTime + t.exitTime) / 2),
        color: '#f59e0b',
        shape: 'diamond' as const,
      },
    ]);
  }, [demoTrades, showAnnotations]);

  const handleBarClick = (bar: OHLCVBar | null) => {
    setSelectedBar(bar);
    const selected = bar
      ? demoTrades.find((t) => t.entryTime === bar.timestamp || t.exitTime === bar.timestamp)
      : null;
    setSelectedTradeId(selected ? selected.id : null);
  };

  const focusTrade = (id: string) => {
    setSelectedTradeId(id);
    setFocusTradeId(id);
  };

  // --- LineChart showcase ----------------------------------------------------
  // Inline sample per-trade PnL (%) for three strategy variants, accumulated
  // into equity curves on an ordinal x-axis (trade #). Demonstrates the public
  // `LineChart` component: several overlaid series, a baseline at 0, a legend.
  const equityCurves = useMemo<LineChartSeries[]>(() => {
    const perTrade: Record<string, number[]> = {
      Momentum: [1.2, 0.8, -0.6, 1.5, 2.1, -1.0, 0.9, 1.8, -0.4, 1.1, 0.7, 1.6],
      Balanced: [0.6, 0.5, 0.4, -0.3, 0.8, 0.7, -0.2, 0.9, 0.5, 0.6, -0.1, 0.7],
      Precision: [0.3, -0.4, 0.5, 0.6, -0.2, 0.4, 0.5, -0.5, 0.7, 0.3, 0.4, 0.5],
    };
    const colors: Record<string, string> = {
      Momentum: '#2dd4bf',
      Balanced: '#3b82f6',
      Precision: '#f59e0b',
    };
    const toCurve = (pnls: number[]): { x: number; y: number }[] => {
      let cum = 0;
      // x = 0 anchors every curve at flat (0%) before the first trade.
      const pts = [{ x: 0, y: 0 }];
      pnls.forEach((p, i) => {
        cum += p;
        pts.push({ x: i + 1, y: cum });
      });
      return pts;
    };
    return Object.keys(perTrade).map((id) => ({
      id,
      label: id,
      color: colors[id],
      data: toCurve(perTrade[id]),
    }));
  }, []);

  const pill = (active: boolean) =>
    `px-3 py-1 text-xs rounded-full border transition ${
      active
        ? 'bg-slate-600 border-slate-500 text-white'
        : 'border-slate-600 text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-slate-100">candlekit</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">
                  {USE_ALPACA ? `${symbol} (Alpaca)` : 'Mock data'}
                </span>
                {USE_ALPACA && (
                  <span className={`text-xs ${
                    connected ? 'text-green-400' : 'text-slate-500'
                  }`}>
                    {connected ? '● Connected' : '○ Disconnected'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {USE_ALPACA && (
              <>
                <button
                  onClick={() => fetchHistorical()}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={() => connected ? unsubscribe() : subscribe()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    connected
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  {connected ? 'Disconnect' : 'Connect'} Live
                </button>
              </>
            )}
            <button
              onClick={() => setIsBrowserOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus size={18} />
              Add Indicator
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-4">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}
        {loading && bars.length === 0 && (
          <div className="bg-slate-800 rounded-lg shadow-xl p-12 mb-6 text-center">
            <RefreshCw className="animate-spin mx-auto mb-4 text-blue-500" size={48} />
            <p className="text-slate-300">Loading market data...</p>
          </div>
        )}
        {(!loading || bars.length > 0) && (
          <div className="bg-slate-800 rounded-lg shadow-xl p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-xs text-slate-400 max-w-3xl">
                <span className="text-slate-300 font-semibold">Try it:</span> right-click to add a line,
                then <span className="text-slate-300">drag</span> it to reprice or{' '}
                <span className="text-slate-300">double-click</span> to edit ·{' '}
                <span className="text-slate-300">hover</span> a trade to preview its entry/stop/target,
                MFE↔MAE box, signposts and a hollow counterfactual exit · the strip along the bottom is the
                event rail · <span className="text-slate-300">Escape</span> closes the indicator dialogs ·
                drag the panel's bottom-right corner: the chart fills whatever height it is given.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Trade marks</span>
                <button className={pill(markStyle === 'price')} onClick={() => setMarkStyle('price')}>
                  ▶ ◀ at price
                </button>
                <button className={pill(markStyle === 'arrows')} onClick={() => setMarkStyle('arrows')}>
                  ▲ ▼ arrows
                </button>
                <button className={pill(showAnnotations)} onClick={() => setShowAnnotations((v) => !v)}>
                  Event rail
                </button>
                <span className="text-xs text-slate-500 ml-2">Volume</span>
                <button className={pill(volumeMode === 'pane')} onClick={() => setVolumeMode('pane')}>
                  Pane
                </button>
                <button className={pill(volumeMode === 'overlay')} onClick={() => setVolumeMode('overlay')}>
                  Overlay
                </button>
              </div>
            </div>
            {/* No `height` prop: the chart fills this resizable box. */}
            <div
              className="rounded-lg border border-slate-700 overflow-hidden"
              style={{ height: 560, minHeight: 320, resize: 'vertical' }}
            >
              <ChartComponent
                bars={bars}
                onLoadMoreData={handleLoadMoreData}
                indicators={indicators}
                lines={[...lines, ...tradeLines]}
                priceBands={tradeBands}
                markers={tradeMarkers}
                signposts={showAnnotations ? tradeSignposts : undefined}
                railMarkers={railMarkers}
                onDeleteLine={removeLine}
                onAddLine={addLineByType}
                onClearAllLines={clearAllLines}
                onLineMove={updateLine}
                onLineChange={handleLineChange}
                onHoverBar={handleHoverBar}
                enableBarSelection={true}
                onBarClick={handleBarClick}
                trades={demoTrades}
                selectedTradeId={selectedTradeId}
                focusTradeId={focusTradeId}
                renderTradePopup={(t) => {
                  const stop = t.entryPrice * 0.985;
                  const risk = t.entryPrice - stop;
                  const r = risk !== 0 ? (t.exitPrice - t.entryPrice) / risk : 0;
                  const isWin = t.outcome === 'win';
                  return (
                    <div className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-200 shadow-lg">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-bold uppercase tracking-wide">{t.id}</span>
                        <span className={isWin ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                          {t.outcome}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Entry {new Date(t.entryTime).toLocaleTimeString()} @ {t.entryPrice.toFixed(2)}
                      </div>
                      <div className="text-slate-400">
                        Exit {new Date(t.exitTime).toLocaleTimeString()} @ {t.exitPrice.toFixed(2)}
                      </div>
                      <div className="mt-1">
                        R-multiple: <span className="font-mono">{r.toFixed(2)}R</span>
                      </div>
                    </div>
                  );
                }}
                timeZone="America/New_York"
                sessions
                showOhlcLegend
                volumeMode={volumeMode}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-1">Trades</h3>
            <p className="text-xs text-slate-400 mb-3">
              Focus scrolls the chart to a trade once; it stays put while you pan, scroll back for history
              or bars update.
            </p>
            <div className="space-y-1.5 mb-4">
              {demoTrades.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${
                    t.id === selectedTradeId ? 'bg-slate-600' : 'bg-slate-700'
                  }`}
                >
                  <span className="font-mono text-slate-200">
                    {i + 1}. {t.id}
                    {t.muted && <span className="ml-2 text-xs text-slate-400">muted</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={t.outcome === 'win' ? 'text-green-400 text-xs' : 'text-red-400 text-xs'}>
                      {t.outcome}
                    </span>
                    <button
                      onClick={() => focusTrade(t.id)}
                      className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                    >
                      <Crosshair size={14} /> Focus
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Lines at the last close</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={lastClose === null}
                onClick={() => lastClose !== null && addEntryLine(lastClose)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs disabled:opacity-50"
              >
                Entry
              </button>
              <button
                disabled={lastClose === null}
                onClick={() => lastClose !== null && addStopLoss(lastClose * 0.99)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs disabled:opacity-50"
              >
                Stop −1%
              </button>
              <button
                disabled={lastClose === null}
                onClick={() => lastClose !== null && addTakeProfit(lastClose * 1.02)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-xs disabled:opacity-50"
              >
                Target +2%
              </button>
              <button
                onClick={clearAllLines}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-xs"
              >
                Clear lines
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-1">Indicators</h3>
            <p className="text-xs text-slate-400 mb-3">
              Saved in localStorage under this demo's own key.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => addIndicator('swingpoints', { plotAt: 'confirmation' })}
                className={pill(false)}
              >
                + Swing Points (at confirmation)
              </button>
              <button onClick={() => addIndicator('vwap')} className={pill(false)}>
                + VWAP
              </button>
              <button onClick={() => addIndicator('rsi')} className={pill(false)}>
                + RSI
              </button>
            </div>
            <div className="space-y-2">
              {indicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                >
                  <span className="text-slate-200 text-sm">{indicator.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedIndicator(indicator);
                        setIsSettingsOpen(true);
                      }}
                      className="text-slate-400 hover:text-slate-200 transition"
                      aria-label={`Settings for ${indicator.name}`}
                    >
                      <Settings size={18} />
                    </button>
                    <button
                      onClick={() => removeIndicator(indicator.id)}
                      className="text-slate-400 hover:text-red-400 transition"
                      aria-label={`Remove ${indicator.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {indicators.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">
                  No indicators added yet
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Selected Bar</h3>
            {selectedBar ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Time:</span>
                  <span className="text-slate-200 font-mono">
                    {new Date(selectedBar.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Open:</span>
                  <span className="text-slate-200 font-mono">${selectedBar.open.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">High:</span>
                  <span className="text-green-400 font-mono">${selectedBar.high.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Low:</span>
                  <span className="text-red-400 font-mono">${selectedBar.low.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Close:</span>
                  <span className="text-slate-200 font-mono">${selectedBar.close.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume:</span>
                  <span className="text-slate-200 font-mono">{selectedBar.volume.toLocaleString()}</span>
                </div>
                {selectedBar.vwap && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">VWAP:</span>
                    <span className="text-slate-200 font-mono">${selectedBar.vwap.toFixed(3)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">
                Click on a bar to view details
              </p>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg shadow-xl p-6 mt-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-slate-100">Equity Curves</h3>
            <span className="text-xs text-slate-400 font-mono">LineChart · ordinal x · baseline 0</span>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Cumulative PnL by strategy variant, overlaid on a shared ordinal axis (trade #).
          </p>
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <LineChart
              series={equityCurves}
              height={320}
              baseline={0}
              xTickFormatter={(x) => `#${x}`}
              valueFormatter={(y) => `${y >= 0 ? '+' : ''}${y.toFixed(1)}%`}
            />
          </div>
        </div>
      </main>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setSelectedIndicator(null);
        }}
        indicator={selectedIndicator}
        onSave={handleSettingsSave}
      />
      <IndicatorBrowser
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onAddIndicator={(definitionId) => addIndicator(definitionId)}
      />
    </div>
  );
}

function App() {
  return (
    <ChartAPIProvider persistenceAdapter={persistenceAdapter}>
      <AppContent />
    </ChartAPIProvider>
  );
}

export default App;
