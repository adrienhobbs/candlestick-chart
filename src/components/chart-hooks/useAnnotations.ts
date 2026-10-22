import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
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
}
