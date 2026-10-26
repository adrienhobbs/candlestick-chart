import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { ChartLine, OHLCVBar, PriceBand } from '../../types/chart';
import {
  TradeOverlaysPrimitive,
  type TradeOverlaysConfig,
} from '../../indicators/primitives/TradeOverlaysPrimitive';
import { snapSpan } from '../trade-markers';

/** Ascending, deduped bar timestamps (ms). */
export function ascendingBarTimes(bars: OHLCVBar[]): number[] {
  const times = Array.from(new Set(bars.map((b) => b.timestamp)));
  times.sort((a, b) => a - b);
  return times;
}

/**
 * Bounded lines/bands → the primitive's config, each span snapped onto the bars
 * (the primitive can only place a real bar time). A span ending before the first
 * bar is dropped. Seconds are converted exactly as the bar series converts them
 * (no flooring): a bar time that isn't a whole second would otherwise match no bar
 * and clamp to the plot edges.
 */
export function buildTradeOverlaysConfig(
  lines: ChartLine[],
  bands: PriceBand[],
  barTimes: number[],
): TradeOverlaysConfig {
  const segments: TradeOverlaysConfig['segments'] = [];
  for (const l of lines) {
    const span = snapSpan(barTimes, l.startTime as number, l.endTime as number);
    if (!span) continue;
    segments.push({
      id: l.id,
      price: l.price,
      startSec: span.start / 1000,
      endSec: span.end / 1000,
      color: l.color,
      lineWidth: l.lineWidth ?? 2,
      lineStyle: l.lineStyle ?? 'solid',
      title: l.title,
    });
  }
  const boxes: TradeOverlaysConfig['boxes'] = [];
  for (const b of bands) {
    const span = snapSpan(barTimes, b.startTime as number, b.endTime as number);
    if (!span) continue;
    boxes.push({
      id: b.id,
      top: b.top,
      bottom: b.bottom,
      startSec: span.start / 1000,
      endSec: span.end / 1000,
      color: b.color,
      topLabel: b.topLabel,
      bottomLabel: b.bottomLabel,
      topLabelColor: b.topLabelColor,
      bottomLabelColor: b.bottomLabelColor,
    });
  }
  return { segments, boxes };
}

interface UseTradeOverlaysArgs {
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  bars: OHLCVBar[];
  /** Bounded lines (both startTime & endTime set) → segments. */
  lines: ChartLine[];
  /** Bounded bands (both startTime & endTime set) → boxes. */
  bands: PriceBand[];
}

/**
 * Attach a {@link TradeOverlaysPrimitive} for time-bounded segments + boxes (trade
 * overlays). Mirrors {@link useSessions}: attach-once (toggled by enabled/disabled),
 * apply-options in place on data change — never re-attach (would stack duplicates).
 */
export function useTradeOverlays({ candlestickSeriesRef, bars, lines, bands }: UseTradeOverlaysArgs) {
  const primitiveRef = useRef<TradeOverlaysPrimitive | null>(null);

  const barTimes = useMemo(() => ascendingBarTimes(bars), [bars]);

  // Normalize to the primitive's seconds-based config (defaults resolved).
  const config = useMemo<TradeOverlaysConfig>(
    () => buildTradeOverlaysConfig(lines, bands, barTimes),
    [lines, bands, barTimes],
  );

  const configRef = useRef(config);
  configRef.current = config;
  const enabled = config.segments.length > 0 || config.boxes.length > 0;

  // Attach once when there's anything to draw (detach when empty / on unmount).
  useEffect(() => {
    if (!enabled) return;
    const series = candlestickSeriesRef.current;
    if (!series) return;
    const primitive = new TradeOverlaysPrimitive(configRef.current);
    series.attachPrimitive(primitive);
    primitiveRef.current = primitive;
    return () => {
      try {
        series.detachPrimitive(primitive);
      } catch {
        // series already disposed (chart.remove during teardown) — ignore.
      }
      primitiveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Apply overlay changes in place (also triggers a redraw via requestUpdate).
  useEffect(() => {
    primitiveRef.current?.applyOptions(config);
  }, [config]);
}
