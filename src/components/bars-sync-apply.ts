import type { CandlestickData, HistogramData, Time } from 'lightweight-charts';
import type { ChartTheme, OHLCVBar } from '../types/chart';
import { sameBar, type BarsSyncPlan } from './bars-sync-plan';

/** The two series methods bar syncing uses (an `ISeriesApi` satisfies it). */
interface SeriesSink<T> {
  setData(data: T[]): void;
  update(item: T): void;
}

type VolumeColors = Pick<ChartTheme, 'volumeUpColor' | 'volumeDownColor'>;

const toCandle = (bar: OHLCVBar): CandlestickData => ({
  time: (bar.timestamp / 1000) as Time,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
});

const toVolume = (bar: OHLCVBar, theme: VolumeColors): HistogramData => ({
  time: (bar.timestamp / 1000) as Time,
  value: bar.volume,
  color: bar.close >= bar.open ? theme.volumeUpColor : theme.volumeDownColor,
});

/** Carries out a {@link BarsSyncPlan} on the candle and volume series. */
export function applyBarsSync(
  plan: BarsSyncPlan,
  prev: OHLCVBar[],
  next: OHLCVBar[],
  candles: SeriesSink<CandlestickData>,
  volume: SeriesSink<HistogramData>,
  theme: VolumeColors,
): void {
  if (plan === 'set') {
    candles.setData(next.map(toCandle));
    volume.setData(next.map((b) => toVolume(b, theme)));
    return;
  }
  const updates: OHLCVBar[] = [];
  if (plan === 'update') updates.push(next[next.length - 1]);
  if (plan === 'append') {
    const closedBefore = prev[prev.length - 1];
    const closedNow = next[next.length - 2];
    if (!sameBar(closedBefore, closedNow)) updates.push(closedNow);
    updates.push(next[next.length - 1]);
  }
  for (const bar of updates) {
    candles.update(toCandle(bar));
    volume.update(toVolume(bar, theme));
  }
}
