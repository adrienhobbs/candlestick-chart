import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartComponent, indicatorRegistry, useRealtimeBars } from './index';
import type {
  GapFetchOptions,
  GapRange,
  IndicatorInstance,
  LiveConnection,
  LiveStreamState,
  OHLCVBar,
  RealtimeTick,
} from './index';

const MINUTE = 60_000;
const SYMBOL = 'DEMO';
const HISTORY_BARS = 2000;

/** Random-walk 1Min bars from `fromMs` to `toMs` (bucket starts, inclusive), drifting from `startPrice` to `endPrice`. */
function synthBars(fromMs: number, toMs: number, startPrice: number, endPrice = startPrice): OHLCVBar[] {
  const out: OHLCVBar[] = [];
  const steps = Math.max(1, Math.round((toMs - fromMs) / MINUTE));
  let price = startPrice;
  for (let t = fromMs, i = 1; t <= toMs; t += MINUTE, i++) {
    const open = price;
    const target = startPrice + ((endPrice - startPrice) * i) / steps;
    const close = Math.max(1, target + (Math.random() - 0.5) * 0.6);
    out.push({
      timestamp: t,
      open,
      high: Math.max(open, close) + Math.random() * 0.2,
      low: Math.min(open, close) - Math.random() * 0.2,
      close,
      volume: 1000 + Math.floor(Math.random() * 4000),
    });
    price = close;
  }
  return out;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const STATE_COLOR: Record<LiveStreamState, string> = {
  connecting: 'text-amber-400',
  live: 'text-green-400',
  stalled: 'text-amber-400',
  disconnected: 'text-red-400',
};

/**
 * A 1Min chart fed by a simulated socket: ticks go through `pushTick` from a timer,
 * outside React render. Controls drop and restore the stream (gap-fill), stall it,
 * and fire a burst with a spike in one call (the wick must survive the frame).
 */
export function LiveDemo() {
  const [bars] = useState(() => {
    const now = Math.floor(Date.now() / MINUTE) * MINUTE;
    return synthBars(now - HISTORY_BARS * MINUTE, now - MINUTE, 100);
  });
  const [liveOn, setLiveOn] = useState(true);
  const [connection, setConnection] = useState<LiveConnection>('open');
  const [stalled, setStalled] = useState(false);
  const [fast, setFast] = useState(false);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [streamState, setStreamState] = useState<LiveStreamState>('connecting');
  const [gapLog, setGapLog] = useState<string[]>([]);
  const priceRef = useRef(bars[bars.length - 1].close);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The bars on screen, so a backfill starts from the close the chart last showed.
  const shownBarsRef = useRef<OHLCVBar[]>(bars);

  const log = useCallback((line: string) => {
    setGapLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 6));
  }, []);

  const fetchGap = useCallback(
    async ({ fromMs, toMs }: GapRange, { signal }: GapFetchOptions) => {
      log(`gap request ${fmtTime(fromMs)} → ${fmtTime(toMs)}`);
      await abortableDelay(400, signal);
      const shown = shownBarsRef.current;
      const from = shown.find((b) => b.timestamp === fromMs) ?? shown[shown.length - 1];
      const fetched = synthBars(fromMs + MINUTE, toMs, from?.close ?? priceRef.current, priceRef.current);
      log(`gap filled: ${fetched.length} bar(s)`);
      return fetched;
    },
    [log],
  );

  const onGapError = useCallback((err: unknown) => log(`gap error: ${String(err)}`), [log]);

  const realtime = useRealtimeBars({
    key: liveOn ? SYMBOL : null,
    bars,
    timeframe: '1Min',
    connection,
    fetchGap,
    onGapError,
    stallAfterMs: 5_000,
  });
  const { pushTick } = realtime;
  useEffect(() => {
    shownBarsRef.current = realtime.bars;
  }, [realtime.bars]);

  const nextTick = useCallback((): RealtimeTick => {
    priceRef.current = Math.max(1, priceRef.current + (Math.random() - 0.5) * 0.15);
    return { key: SYMBOL, price: priceRef.current, time: Date.now(), size: 1 + Math.floor(Math.random() * 200) };
  }, []);

  // The simulated socket: a timer pushes ticks straight into the hook, never through state.
  useEffect(() => {
    if (!liveOn || connection !== 'open' || stalled) return;
    const id = setInterval(() => pushTick(nextTick()), fast ? 50 : 250);
    return () => clearInterval(id);
  }, [liveOn, connection, stalled, fast, pushTick, nextTick]);

  useEffect(
    () => () => {
      if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    },
    [],
  );

  const drop = () => {
    if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    setConnection('closed');
    log('socket closed');
  };

  const reconnect = () => {
    setConnection('connecting');
    log('socket connecting');
    // The market kept moving while the socket was down.
    priceRef.current = Math.max(1, priceRef.current + (Math.random() - 0.5) * 3);
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      setConnection('open');
      log('socket open');
    }, 800);
  };

  // Several ticks in one push, with a spike in the middle: the spike's wick must
  // survive even though the whole burst lands in a single frame.
  const burst = () => {
    const base = priceRef.current;
    const ticks: RealtimeTick[] = [];
    for (let i = 0; i < 20; i++) {
      const t = nextTick();
      if (i === 10) t.price = base + 2.5;
      if (i === 11) t.price = base - 2.5;
      ticks.push(t);
    }
    pushTick(ticks);
    log(`burst: 20 ticks, spike to ${(base + 2.5).toFixed(2)} / ${(base - 2.5).toFixed(2)}`);
  };

  const bollinger = useMemo<IndicatorInstance>(() => indicatorRegistry.createInstance('bollinger'), []);
  const indicators = useMemo(() => (showBollinger ? [bollinger] : []), [showBollinger, bollinger]);

  const btn = 'px-3 py-1 rounded text-xs border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-40';
  const toggle = (on: boolean) =>
    `px-3 py-1 text-xs rounded-full border transition ${
      on ? 'bg-slate-600 border-slate-500 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200'
    }`;
  const socketUp = liveOn && connection === 'open';

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl p-6 mt-6">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold text-slate-100 mr-2">Realtime</h3>
        <span className="text-xs text-slate-400">
          socket: <span className="font-mono">{liveOn ? connection : 'off'}</span> · stream:{' '}
          <span className={`font-mono ${liveOn ? STATE_COLOR[streamState] : 'text-slate-500'}`}>
            {liveOn ? streamState : 'off'}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button className={toggle(liveOn)} onClick={() => {
            setLiveOn((v) => !v);
            setStreamState('connecting');
          }}>
          Live {liveOn ? 'on' : 'off'}
        </button>
        <button
          className={btn}
          onClick={connection === 'closed' ? reconnect : drop}
          disabled={!liveOn || connection === 'connecting'}
        >
          {connection === 'closed' ? 'Reconnect' : 'Disconnect'}
        </button>
        <button className={btn} onClick={() => setStalled((s) => !s)} disabled={!socketUp}>
          {stalled ? 'Resume ticks' : 'Stall (stop ticks)'}
        </button>
        <button className={btn} onClick={burst} disabled={!socketUp}>
          Burst + spike
        </button>
        <button className={toggle(fast)} onClick={() => setFast((v) => !v)}>
          {fast ? '20 ticks/s' : '4 ticks/s'}
        </button>
        <span className="text-xs text-slate-500 ml-2">Overlays</span>
        <button className={toggle(showBollinger)} onClick={() => setShowBollinger((v) => !v)}>
          Bollinger
        </button>
        <button className={toggle(showSessions)} onClick={() => setShowSessions((v) => !v)}>
          Sessions
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-3 max-w-3xl">
        {HISTORY_BARS.toLocaleString()} synthetic 1Min bars. Stall: the stream reads <span className="font-mono">stalled</span>{' '}
        5 s after the last tick. Disconnect, wait past a minute boundary, then Reconnect: the missed minutes are
        backfilled through <span className="font-mono">fetchGap</span>.
      </p>
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <ChartComponent
          bars={realtime.bars}
          live={realtime.live}
          onLiveStateChange={setStreamState}
          indicators={indicators}
          sessions={showSessions}
          timeZone="America/New_York"
          showOhlcLegend
          height={420}
        />
      </div>
      {gapLog.length > 0 && (
        <ul className="mt-2 text-xs font-mono text-slate-400 space-y-0.5">
          {gapLog.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
