import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { KeepOut } from '../annotations-layout';
import { ISeriesApi } from 'lightweight-charts';
import type { ChartMarker, ChartRailMarker, ChartSignpost, ChartTheme, ChartTrade, OHLCVBar } from '../../types/chart';
import { AnnotationsPrimitive } from '../../indicators/primitives/AnnotationsPrimitive';
import { buildTradePriceMarkers, isCustomDrawnMarker } from '../trade-markers';

interface UseAnnotationsArgs {
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  bars: OHLCVBar[];
  trades: ChartTrade[];
  markers: ChartMarker[];
  signposts: ChartSignpost[];
  rail: ChartRailMarker[];
  resolvedTheme: ChartTheme;
  /** Box the signpost pills stay out of (the OHLC legend), or null. */
  keepOut: KeepOut | null;
}

/**
 * Attach one {@link AnnotationsPrimitive} to the candlestick series (create-once) and
 * feed it what series markers can't draw: ▶/◀ and hollow markers, `markerStyle: 'price'`
 * trade entries/exits, signposts and the event rail.
 */
export function useAnnotations({
  candlestickSeriesRef,
  bars,
  trades,
  markers,
  signposts,
  rail,
  resolvedTheme,
  keepOut,
}: UseAnnotationsArgs) {
  const primitiveRef = useRef<AnnotationsPrimitive | null>(null);

  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series) return;
    const primitive = new AnnotationsPrimitive();
    series.attachPrimitive(primitive);
    primitiveRef.current = primitive;
    return () => {
      try {
        series.detachPrimitive(primitive);
      } catch {
        // series already disposed during teardown — ignore.
      }
      primitiveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barTimes = useMemo(
    () => [...new Set(bars.map((b) => b.timestamp))].sort((a, b) => a - b),
    [bars],
  );

  useEffect(() => {
    const primitive = primitiveRef.current;
    if (!primitive) return;
    const custom = [
      ...buildTradePriceMarkers(trades, { win: resolvedTheme.upColor, loss: resolvedTheme.downColor }),
      ...markers.filter(isCustomDrawnMarker),
    ];
    primitive.setData({ markers: custom, signposts, rail }, bars, barTimes);
  }, [bars, barTimes, trades, markers, signposts, rail, resolvedTheme]);

  useEffect(() => {
    primitiveRef.current?.setKeepOut(keepOut);
  }, [keepOut]);
}

/**
 * Measure an element pinned in the chart's top-left corner (the OHLC legend) as a
 * keep-out box for the signpost pills. The box only grows while `resetKey` stays
 * the same, so pills don't hop between rows as hovered values change the
 * legend's width.
 */
export function useKeepOutBox(
  elementRef: RefObject<HTMLElement>,
  offset: { left: number; top: number },
  resetKey: unknown,
): KeepOut | null {
  const [box, setBox] = useState<KeepOut | null>(null);
  const { left, top } = offset;
  useEffect(() => {
    const el = elementRef.current;
    if (!el) {
      setBox(null);
      return;
    }
    let maxW = 0;
    let maxH = 0;
    const measure = () => {
      maxW = Math.max(maxW, el.offsetWidth);
      maxH = Math.max(maxH, el.offsetHeight);
      const right = left + maxW;
      const bottom = top + maxH;
      setBox((prev) => (prev && prev.right === right && prev.bottom === bottom ? prev : { right, bottom }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [elementRef, left, top, resetKey]);
  return box;
}
