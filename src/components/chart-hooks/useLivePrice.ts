import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { IChartApi, IPriceLine, ISeriesApi, LineStyle } from 'lightweight-charts';
import type { ChartTheme } from '../../types/chart';
import type { LiveState, LiveStreamState } from '../../realtime/types';
import { COUNTDOWN_HEIGHT_PX, contrastTextColor, countdownText, livePriceColor, tagHalfHeight } from '../live-price';

interface UseLivePriceArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  countdownRef: RefObject<HTMLDivElement>;
  live: LiveState | null | undefined;
  theme: ChartTheme;
  onLiveStateChange?: (state: LiveStreamState) => void;
}

interface HeldLine {
  series: ISeriesApi<'Candlestick'>;
  line: IPriceLine;
  /** The series' own options before the live line hid them. */
  restore: { priceLineVisible: boolean; lastValueVisible: boolean };
}

interface CountdownView {
  shown: boolean;
  top: string;
  width: string;
  background: string;
  color: string;
  text: string;
}

const HIDDEN: CountdownView = { shown: false, top: '', width: '', background: '', color: '', text: '' };

/**
 * Draws `live` on the chart: a price line with axis tag (replacing the series' own
 * last-value line while set) and a bar-close countdown under the tag. The countdown
 * is written to its element directly, without re-rendering the chart: its position
 * follows the axis every animation frame and its text every second.
 */
export function useLivePrice({ chartRef, candlestickSeriesRef, countdownRef, live, theme, onLiveStateChange }: UseLivePriceArgs) {
  const lineRef = useRef<HeldLine | null>(null);
  const liveRef = useRef<LiveState | null>(live ?? null);
  liveRef.current = live ?? null;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const writtenRef = useRef<{ el: HTMLDivElement; view: CountdownView } | null>(null);

  const viewNow = (): CountdownView => {
    const current = liveRef.current;
    const series = candlestickSeriesRef.current;
    const chart = chartRef.current;
    const text = countdownText(current, Date.now());
    if (!current || !series || !chart || text === null) return HIDDEN;
    const y = series.priceToCoordinate(current.price);
    if (y === null || y < 0) return HIDDEN;
    const top = y + tagHalfHeight(chart.options().layout?.fontSize);
    const paneHeight = chart.panes()[0]?.getHeight() ?? 0;
    const width = chart.priceScale('right').width();
    if (top + COUNTDOWN_HEIGHT_PX > paneHeight || width <= 0) return HIDDEN;
    const background = livePriceColor(current, themeRef.current);
    return { shown: true, top: `${top}px`, width: `${width}px`, background, color: contrastTextColor(background), text };
  };

  // Writes only what changed since the last write to this element.
  const place = () => {
    const el = countdownRef.current;
    if (!el) return;
    const next = viewNow();
    const prev = writtenRef.current?.el === el ? writtenRef.current.view : null;
    if (prev?.shown !== next.shown) el.style.display = next.shown ? 'block' : 'none';
    if (next.shown) {
      if (prev?.top !== next.top) el.style.top = next.top;
      if (prev?.width !== next.width) el.style.width = next.width;
      if (prev?.background !== next.background) el.style.background = next.background;
      if (prev?.color !== next.color) el.style.color = next.color;
      if (prev?.text !== next.text) el.textContent = next.text;
    }
    // While hidden the other fields keep what the element last showed.
    writtenRef.current = { el, view: next.shown ? next : { ...(prev ?? HIDDEN), shown: false } };
  };
  const placeRef = useRef(place);
  placeRef.current = place;

  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series) return;
    const held = lineRef.current;
    if (!live) {
      if (held) {
        // A recreated series no longer has the old line or the hidden options.
        if (held.series === series) {
          series.removePriceLine(held.line);
          series.applyOptions(held.restore);
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
      const { priceLineVisible, lastValueVisible } = series.options();
      series.applyOptions({ priceLineVisible: false, lastValueVisible: false });
      const line = series.createPriceLine({
        price: live.price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '',
      });
      lineRef.current = { series, line, restore: { priceLineVisible, lastValueVisible } };
    }
    placeRef.current();
  }, [live, theme, candlestickSeriesRef]);

  // The axis can move without a tick (zoom, autoscale, pane resize), so the position
  // is re-read every frame; the interval keeps the text going while frames pause.
  const hasCountdown = live != null && live.barCloseAt !== null;
  useEffect(() => {
    if (!hasCountdown) return;
    let frame = requestAnimationFrame(function loop() {
      placeRef.current();
      frame = requestAnimationFrame(loop);
    });
    const id = setInterval(() => placeRef.current(), 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [hasCountdown]);

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
