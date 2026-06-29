import { useEffect, useState, type MutableRefObject } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { PriceBand } from '../../types/chart';

interface UsePriceBandsArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  priceBands: PriceBand[];
}

/**
 * Shaded price bands: project top/bottom prices to container-relative px and
 * keep them in sync as the price scale auto-rescales (scroll/zoom/resize).
 * Returns the rects for the render.
 */
export function usePriceBands({
  chartRef,
  candlestickSeriesRef,
  priceBands,
}: UsePriceBandsArgs) {
  const [bandRects, setBandRects] = useState<Array<{ id: string; top: number; height: number; color: string }>>([]);

  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!chartRef.current || !series) return;
    if (priceBands.length === 0) {
      setBandRects([]);
      return;
    }
    const recompute = () => {
      if (!candlestickSeriesRef.current) return;
      const rects: Array<{ id: string; top: number; height: number; color: string }> = [];
      for (const band of priceBands) {
        const yTop = candlestickSeriesRef.current.priceToCoordinate(band.top);
        const yBottom = candlestickSeriesRef.current.priceToCoordinate(band.bottom);
        if (yTop == null || yBottom == null) continue;
        const top = Math.min(yTop, yBottom);
        const height = Math.abs(yBottom - yTop);
        rects.push({ id: band.id, top, height, color: band.color });
      }
      setBandRects(rects);
    };
    const raf = requestAnimationFrame(recompute);
    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf);
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [priceBands]);

  return bandRects;
}
