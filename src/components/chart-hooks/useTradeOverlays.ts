import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { ChartLine, PriceBand } from '../../types/chart';
import {
  TradeOverlaysPrimitive,
  type TradeOverlaysConfig,
} from '../../indicators/primitives/TradeOverlaysPrimitive';

interface UseTradeOverlaysArgs {
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
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
export function useTradeOverlays({ candlestickSeriesRef, lines, bands }: UseTradeOverlaysArgs) {
  const primitiveRef = useRef<TradeOverlaysPrimitive | null>(null);

  // Normalize to the primitive's seconds-based config (defaults resolved).
  const config = useMemo<TradeOverlaysConfig>(() => ({
    segments: lines.map((l) => ({
      id: l.id,
      price: l.price,
      startSec: Math.floor((l.startTime as number) / 1000),
      endSec: Math.floor((l.endTime as number) / 1000),
      color: l.color,
      lineWidth: l.lineWidth ?? 2,
      lineStyle: l.lineStyle ?? 'solid',
      title: l.title,
    })),
    boxes: bands.map((b) => ({
      id: b.id,
      top: b.top,
      bottom: b.bottom,
      startSec: Math.floor((b.startTime as number) / 1000),
      endSec: Math.floor((b.endTime as number) / 1000),
      color: b.color,
      topLabel: b.topLabel,
      bottomLabel: b.bottomLabel,
    })),
  }), [lines, bands]);

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
