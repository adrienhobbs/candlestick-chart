import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { IChartApi, IPriceLine, ISeriesApi, LineStyle } from 'lightweight-charts';
import type { ChartTheme } from '../../types/chart';
import type { LiveState, LiveStreamState } from '../../realtime/types';
import { countdownText, livePriceColor } from '../live-price';

/** Half the axis tag's height: the countdown sits just under the price tag. */
const LIVE_TAG_HALF_HEIGHT = 9;

interface UseLivePriceArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  countdownRef: RefObject<HTMLDivElement>;
  live: LiveState | null | undefined;
  theme: ChartTheme;
  onLiveStateChange?: (state: LiveStreamState) => void;
}

/**
 * Draws `live` on the chart: a price line with axis tag (replacing the series' own
 * last-value line while set) and a bar-close countdown under the tag. The countdown
 * is written to its element directly, once a second, without re-rendering the chart.
 */
export function useLivePrice({ chartRef, candlestickSeriesRef, countdownRef, live, theme, onLiveStateChange }: UseLivePriceArgs) {
  const lineRef = useRef<{ series: ISeriesApi<'Candlestick'>; line: IPriceLine } | null>(null);
  const liveRef = useRef<LiveState | null>(live ?? null);
  liveRef.current = live ?? null;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const placeCountdown = () => {
    const el = countdownRef.current;
    if (!el) return;
    const current = liveRef.current;
    const series = candlestickSeriesRef.current;
    const chart = chartRef.current;
    const text = countdownText(current, Date.now());
    const y = current && series ? series.priceToCoordinate(current.price) : null;
    if (!current || !chart || text === null || y === null) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.top = `${y + LIVE_TAG_HALF_HEIGHT}px`;
    el.style.width = `${chart.priceScale('right').width()}px`;
    el.style.background = livePriceColor(current, themeRef.current);
    el.textContent = text;
  };
  const placeRef = useRef(placeCountdown);
  placeRef.current = placeCountdown;

  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series) return;
    const held = lineRef.current;
    if (!live) {
      if (held) {
        // A recreated series no longer has the old line or the hidden options.
        if (held.series === series) {
          series.removePriceLine(held.line);
          series.applyOptions({ priceLineVisible: true, lastValueVisible: true });
        }
        lineRef.current = null;
      }
      placeRef.current();
      return;
    }
    const color = livePriceColor(live, theme);
    if (held && held.series === series) {
      held.line.applyOptions({ price: live.price, color });
    } else {
      series.applyOptions({ priceLineVisible: false, lastValueVisible: false });
      const line = series.createPriceLine({
        price: live.price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '',
      });
      lineRef.current = { series, line };
    }
    placeRef.current();
  }, [live, theme, candlestickSeriesRef]);

  const hasCountdown = live != null && live.barCloseAt !== null;
  useEffect(() => {
    if (!hasCountdown) return;
    const chart = chartRef.current;
    const place = () => placeRef.current();
    const id = setInterval(place, 1000);
    chart?.timeScale().subscribeVisibleLogicalRangeChange(place);
    window.addEventListener('resize', place);
    return () => {
      clearInterval(id);
      chart?.timeScale().unsubscribeVisibleLogicalRangeChange(place);
      window.removeEventListener('resize', place);
    };
  }, [hasCountdown, chartRef]);

  const onChangeRef = useRef(onLiveStateChange);
  onChangeRef.current = onLiveStateChange;
  const lastStateRef = useRef<LiveStreamState | null>(null);
  const state = live?.state ?? null;
  useEffect(() => {
    if (state === lastStateRef.current) return;
    lastStateRef.current = state;
    if (state !== null) onChangeRef.current?.(state);
  }, [state]);
}
