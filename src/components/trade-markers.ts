import type { SeriesMarker, Time } from 'lightweight-charts';
import type { ChartMarker, ChartTrade } from '../types/chart';
import { WIN_COLOR, LOSS_COLOR } from '../constants/colors';

const WIN = WIN_COLOR;
const LOSS = LOSS_COLOR;

/** Opacity of a muted trade's markers. */
export const MUTED_MARKER_ALPHA = 0.4;
/** Used when a muted marker's color isn't a hex we can fade. */
const MUTED_FALLBACK = 'rgba(148, 163, 184, 0.6)';

/** Win/loss marker colors. Defaults match the library's default candle palette;
 *  pass a theme's up/down colors to keep markers consistent with the chart. */
export interface MarkerColors {
  win: string;
  loss: string;
}

/** `#rgb` / `#rrggbb` (an existing alpha suffix is replaced) → `rgba(…, alpha)`; anything else → null. */
export function fadeHex(color: string, alpha: number): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pure: build the entry+exit markers for all trades, sorted ascending by time
 *  (lightweight-charts requires sorted markers). Markers are colored by outcome
 *  (win/loss), faded for a `muted` trade; the selected trade's markers are
 *  emphasized with a text label. */
export function buildTradeMarkers(
  trades: ChartTrade[],
  selectedTradeId: string | null,
  colors: MarkerColors = { win: WIN, loss: LOSS },
): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (const t of trades) {
    if (t.markerStyle === 'price') continue; // drawn as ▶/◀ by the annotations primitive
    const selected = t.id === selectedTradeId;
    const base = t.outcome === 'win' ? colors.win : colors.loss;
    const color = t.muted ? (fadeHex(base, MUTED_MARKER_ALPHA) ?? MUTED_FALLBACK) : base;
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

/** Latest timestamp in ascending `times` at or before `ms`, or null when `ms` precedes them all. */
export function snapDown(times: number[], ms: number): number | null {
  let lo = 0;
  let hi = times.length - 1;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= ms) {
      found = times[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Snap a time-bounded span onto ascending bar times (ms). Both ends snap down to
 * the bar containing them; a start before the first bar clamps to it. An end that
 * lands on the start bar extends to the next bar, since a span needs two distinct
 * bars to be visible. Null when the span ends before the first bar.
 */
export function snapSpan(
  times: number[],
  startMs: number,
  endMs: number,
): { start: number; end: number } | null {
  if (times.length === 0 || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const end = snapDown(times, endMs);
  if (end === null) return null;
  const start = snapDown(times, startMs) ?? times[0];
  if (end > start) return { start, end };
  const next = times.find((t) => t > start);
  return { start, end: next ?? start };
}

/**
 * Pure: host markers → lightweight-charts markers, each snapped down to a bar
 * time in ascending `barTimes` (ms) and sorted ascending. Markers before the
 * first bar, or with a non-finite time, are dropped.
 */
export function buildChartMarkers(markers: ChartMarker[], barTimes: number[]): SeriesMarker<Time>[] {
  if (barTimes.length === 0) return [];
  const out: SeriesMarker<Time>[] = [];
  for (const m of markers) {
    if (!Number.isFinite(m.time)) continue;
    if (isCustomDrawnMarker(m)) continue; // the annotations primitive draws it
    const at = snapDown(barTimes, m.time);
    if (at === null) continue;
    const time = (at / 1000) as Time;
    // isCustomDrawnMarker already took ▶/◀ out; what's left is a lightweight-charts shape.
    const shape = (m.shape ?? 'circle') as 'circle' | 'square' | 'arrowUp' | 'arrowDown';
    const common = {
      id: m.id,
      time,
      shape,
      color: m.color,
      text: m.text ?? '',
      ...(m.size != null ? { size: m.size } : {}),
    };
    const hasPrice = m.price != null && Number.isFinite(m.price);
    const position = m.position ?? (hasPrice ? 'atPriceMiddle' : 'aboveBar');
    if (position.startsWith('atPrice')) {
      if (hasPrice) {
        out.push({ ...common, position: position as 'atPriceTop' | 'atPriceBottom' | 'atPriceMiddle', price: m.price! });
      } else {
        out.push({ ...common, position: 'aboveBar' });
      }
    } else {
      out.push({ ...common, position: position as 'aboveBar' | 'belowBar' | 'inBar' });
    }
  }
  out.sort((a, b) => (a.time as number) - (b.time as number));
  return out;
}

/** Shapes lightweight-charts can't draw (▶ ◀, outlines): the annotations primitive draws these. */
export function isCustomDrawnMarker(m: ChartMarker): boolean {
  return m.hollow === true || m.shape === 'arrowRight' || m.shape === 'arrowLeft';
}

/** Pure: a `markerStyle: 'price'` trade's entry ▶ and exit ◀, at its prices, colored by outcome. */
export function buildTradePriceMarkers(
  trades: ChartTrade[],
  colors: MarkerColors = { win: WIN, loss: LOSS },
): ChartMarker[] {
  const out: ChartMarker[] = [];
  for (const t of trades) {
    if (t.markerStyle !== 'price') continue;
    const base = t.outcome === 'win' ? colors.win : colors.loss;
    const color = t.muted ? (fadeHex(base, MUTED_MARKER_ALPHA) ?? MUTED_FALLBACK) : base;
    out.push({ id: `trade:${t.id}:entry`, time: t.entryTime, price: t.entryPrice, shape: 'arrowRight', color });
    out.push({ id: `trade:${t.id}:exit`, time: t.exitTime, price: t.exitPrice, shape: 'arrowLeft', color });
  }
  return out;
}
