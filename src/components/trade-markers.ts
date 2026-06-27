import type { SeriesMarker, Time } from 'lightweight-charts';
import type { ChartTrade } from '../types/chart';

const WIN = '#10b981';
const LOSS = '#ef4444';
const SEL = '#3b82f6'; // selected emphasis

/** Pure: build the entry+exit markers for all trades, sorted ascending by time
 *  (lightweight-charts requires sorted markers). The selected trade's markers are
 *  emphasized (selection color + a text label). */
export function buildTradeMarkers(trades: ChartTrade[], selectedTradeId: string | null): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (const t of trades) {
    const selected = t.id === selectedTradeId;
    const base = t.outcome === 'win' ? WIN : LOSS;
    const color = selected ? SEL : base;
    markers.push({
      time: (t.entryTime / 1000) as Time,
      position: 'belowBar', shape: 'arrowUp', color,
      text: selected ? `${t.outcome === 'win' ? '+' : ''}entry` : '',
    });
    markers.push({
      time: (t.exitTime / 1000) as Time,
      position: 'aboveBar', shape: 'arrowDown', color,
      text: selected ? 'exit' : '',
    });
  }
  markers.sort((a, b) => (a.time as number) - (b.time as number));
  return markers;
}
