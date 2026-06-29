import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { TrendingUp, Settings, Plus, Trash2, RefreshCw } from 'lucide-react';
import { createChart, BaselineSeries, ColorType, type Time } from 'lightweight-charts';
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
import type { OHLCVBar, ChartTrade, ChartLine, LineChartSeries } from './index';
// NOTE: ChartAPIProvider / useChartAPIContext are NOT part of the public barrel
// (`./index`), so they must still be imported from the context module directly.
import { ChartAPIProvider, useChartAPIContext } from './contexts/ChartAPIContext';

registerBuiltInIndicators();

const USE_ALPACA = !!(import.meta.env.VITE_ALPACA_API_KEY && import.meta.env.VITE_ALPACA_SECRET_KEY);


// Your raw trade signals
const rawSignals = [
  { "t": "2025-11-04T18:45:00Z", "entryIndex": 33, "exitTime": "2025-11-05T14:30:00Z", "pnlPercent": 2.5396986100870724 },
  { "t": "2025-11-05T19:30:00Z", "entryIndex": 63, "exitTime": "2025-11-05T19:45:00Z", "pnlPercent": -1.2718200862882898 },
  { "t": "2025-11-19T15:30:00Z", "entryIndex": 312, "exitTime": "2025-11-19T15:45:00Z", "pnlPercent": -1.8011331451481358 },
  { "t": "2025-11-19T18:45:00Z", "entryIndex": 325, "exitTime": "2025-11-20T14:30:00Z", "pnlPercent": 2.901208533078136 },
  { "t": "2025-11-21T17:30:00Z", "entryIndex": 373, "exitTime": "2025-11-21T20:00:00Z", "pnlPercent": 1.1852502194907795 },
  { "t": "2025-11-21T18:15:00Z", "entryIndex": 376, "exitTime": "2025-11-21T20:45:00Z", "pnlPercent": 1.6858917480035607 },
  { "t": "2025-11-24T18:45:00Z", "entryIndex": 404, "exitTime": "2025-11-24T20:30:00Z", "pnlPercent": 2.074066658830805 },
  { "t": "2025-11-25T19:15:00Z", "entryIndex": 432, "exitTime": "2025-11-25T20:00:00Z", "pnlPercent": 1.7951871648992073 },
  { "t": "2025-11-25T19:30:00Z", "entryIndex": 433, "exitTime": "2025-11-26T13:15:00Z", "pnlPercent": 1.749123624993227 },
  { "t": "2025-11-26T18:15:00Z", "entryIndex": 455, "exitTime": "2025-11-26T20:45:00Z", "pnlPercent": 0.1243265644426073 }
];

export const EquityBaselineChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Narrow the ref into a local so the (possibly null) `.current` stays
    // non-null for the rest of the effect (TS can't narrow `ref.current`
    // across the createChart / addEventListener calls below).
    const container = chartContainerRef.current;
    if (!container) return;

    // 1. Prepare Data
    // Remove duplicates based on entryIndex and sort by exitTime
    const uniqueSignals = Array.from(new Map(rawSignals.map(s => [s.entryIndex, s])).values());
    const sortedSignals = uniqueSignals.sort(
      (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime(),
    );

    // Calculate Cumulative PnL
    let runningPnL = 0;
    const chartData = sortedSignals.map(signal => {
      runningPnL += signal.pnlPercent;
      return {
        // Lightweight Charts expects seconds (Unix timestamp). The x here is a
        // real time value, so cast the ordinal seconds to the library's `Time`.
        time: (new Date(signal.exitTime).getTime() / 1000) as Time,
        value: runningPnL,
      };
    });

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' }, // Dark Charcoal
        textColor: '#d1d4dc', // Light Grey Text
      },
      grid: {
        vertLines: { color: '#1f2937', visible: false }, // Subtle vertical lines
        horzLines: { color: '#2B2B43' }, // Subtle horizontal lines
      },
      width: container.clientWidth,
      height: 400,
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
      localization: {
        priceFormatter: (p: number) => p.toFixed(2) + '%',
      },
    });

    // 3. Add Baseline Series (Dark Theme Colors)
    const baselineSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      
      // Top (Profit) - Bright Teal
      topLineColor: '#00bfa5', 
      topFillColor1: 'rgba(0, 191, 165, 0.28)',
      topFillColor2: 'rgba(0, 191, 165, 0.05)',
      
      // Bottom (Loss) - Bright Red/Pink
      bottomLineColor: '#ff5252', 
      bottomFillColor1: 'rgba(255, 82, 82, 0.05)',
      bottomFillColor2: 'rgba(255, 82, 82, 0.28)',
      
      lineWidth: 2,
    });

    baselineSeries.setData(chartData);
    chart.timeScale().fitContent();

    // 4. Handle Resizing
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="p-4 border rounded shadow-sm">
      <h2 className="text-lg font-bold mb-4">Equity Curve (Baseline)</h2>
      <div 
        ref={chartContainerRef} 
        style={{ width: '100%', height: '400px' }} 
      />
    </div>
  );
};

function AppContent() {
  const [selectedIndicator, setSelectedIndicator] = useState<any>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
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
    addEntryLine,
    addStopLoss,
    addTakeProfit,
    removeLine,
    clearAllLines,
    addLineByType,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings,
  } = useChartAPIContext();

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

  const handleAddIndicator = (definitionId: string) => {
    addIndicator(definitionId);
  };

  const handleSettingsSave = (indicatorId: string, settings: any) => {
    updateIndicatorSettings(indicatorId, settings);
    setIsSettingsOpen(false);
    setSelectedIndicator(null);
  };

  // --- Trade overlay demo ----------------------------------------------------
  // Derive demo trades FROM loaded bars so entry/exit timestamps exactly match
  // real bar timestamps (MockAdapter uses dynamic Date.now()-based spacing).
  const demoTrades = useMemo<ChartTrade[]>(() => {
    if (bars.length < 60) return [];
    const mk = (
      id: string,
      ei: number,
      xi: number,
      outcome: 'win' | 'loss'
    ): ChartTrade => ({
      id,
      entryTime: bars[ei].timestamp,
      exitTime: bars[xi].timestamp,
      entryPrice: bars[ei].close,
      exitPrice: bars[xi].close,
      outcome,
    });
    // Spread the demo trades across the full loaded range so every marker is
    // visible at the default fit (indices derived from bars.length).
    const n = bars.length;
    const at = (frac: number) => Math.min(n - 1, Math.max(0, Math.round(frac * n)));
    return [
      mk('t1', at(0.06), at(0.12), 'win'),
      mk('t2', at(0.24), at(0.30), 'loss'),
      mk('t3', at(0.44), at(0.52), 'win'),
      mk('t4', at(0.64), at(0.70), 'loss'),
      mk('t5', at(0.82), at(0.90), 'win'),
    ];
  }, [bars]);

  // Synthetic overlay lines (stop/target/MFE/MAE) anchored to the selected trade.
  const tradeLines = useMemo<ChartLine[]>(() => {
    const trade = demoTrades.find((t) => t.id === selectedTradeId);
    if (!trade) return [];
    const entry = trade.entryPrice;
    const hi = Math.max(trade.entryPrice, trade.exitPrice);
    const lo = Math.min(trade.entryPrice, trade.exitPrice);
    return [
      { id: 'trade-entry', price: entry, color: '#3b82f6', lineStyle: 'solid', title: 'Entry', type: 'entry' },
      { id: 'trade-stop', price: entry * 0.985, color: '#ef4444', lineStyle: 'dashed', title: 'Stop', type: 'stopLoss' },
      { id: 'trade-target', price: entry * 1.03, color: '#22c55e', lineStyle: 'dashed', title: 'Target', type: 'takeProfit' },
      { id: 'trade-mfe', price: hi * 1.005, color: '#2dd4bf', lineStyle: 'dotted', title: 'MFE', type: 'mfe' },
      { id: 'trade-mae', price: lo * 0.995, color: '#f59e0b', lineStyle: 'dotted', title: 'MAE', type: 'mae' },
    ];
  }, [selectedTradeId, demoTrades]);

  const handleBarClick = (bar: OHLCVBar | null) => {
    setSelectedBar(bar);
    const selected = bar
      ? demoTrades.find((t) => t.entryTime === bar.timestamp || t.exitTime === bar.timestamp)
      : null;
    setSelectedTradeId(selected ? selected.id : null);
    if (bar) {
      console.log('Selected bar:', {
        timestamp: new Date(bar.timestamp).toLocaleString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
    } else {
      console.log('Bar deselected');
    }
  };

  const displayBars = bars;

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

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Trading Chart</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">
                  {USE_ALPACA ? `${symbol} (Alpaca)` : 'Mock Data'}
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
            <ChartComponent
              bars={displayBars}
            onLoadMoreData={handleLoadMoreData}
            indicators={indicators}
            lines={[...lines, ...tradeLines]}
            onDeleteLine={removeLine}
            onAddLine={addLineByType}
            onClearAllLines={clearAllLines}
            enableBarSelection={true}
            onBarClick={handleBarClick}
            trades={demoTrades}
            selectedTradeId={selectedTradeId}
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
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Trading Lines</h3>
            <div className="space-y-2">
              <button
                onClick={() => addEntryLine(15.8)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
              >
                Add Entry @ 15.80
              </button>
              <button
                onClick={() => addStopLoss(15.5)}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
              >
                Add Stop Loss @ 15.50
              </button>
              <button
                onClick={() => addTakeProfit(16.2)}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
              >
                Add Take Profit @ 16.20
              </button>
              <button
                onClick={() => {
                  removeLine('entry');
                  removeLine('stop-loss');
                  removeLine('take-profit');
                }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
              >
                Clear All Lines
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Indicators</h3>
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
                    >
                      <Settings size={18} />
                    </button>
                    <button
                      onClick={() => removeIndicator(indicator.id)}
                      className="text-slate-400 hover:text-red-400 transition"
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
        onAddIndicator={handleAddIndicator}
      />
    </div>
  );
}

function App() {
  const persistenceAdapter = useMemo(() => {
    return createPersistenceAdapter('localStorage');
  }, []);

  return (
    <ChartAPIProvider persistenceAdapter={persistenceAdapter}>
      <AppContent />
    </ChartAPIProvider>
  );
}

export default App;
