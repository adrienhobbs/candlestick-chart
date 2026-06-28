import type { SeriesMarker, Time } from 'lightweight-charts';
import type { ChartTrade } from '../types/chart';

const WIN = '#10b981';
const LOSS = '#ef4444';

/** Win/loss marker colors. Defaults match the library's default candle palette;
 *  pass a theme's up/down colors to keep markers consistent with the chart. */
export interface MarkerColors {
  win: string;
  loss: string;
}

/** Pure: build the entry+exit markers for all trades, sorted ascending by time
 *  (lightweight-charts requires sorted markers). Markers are colored by outcome
 *  (win/loss); the selected trade's markers are emphasized with a text label. */
export function buildTradeMarkers(
  trades: ChartTrade[],
  selectedTradeId: string | null,
  colors: MarkerColors = { win: WIN, loss: LOSS },
): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (const t of trades) {
    const selected = t.id === selectedTradeId;
    const color = t.outcome === 'win' ? colors.win : colors.loss;
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
