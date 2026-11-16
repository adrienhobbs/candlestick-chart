import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { DEFAULT_CHART_THEME } from '../../utils/chartTheme';
import type { LiveState } from '../../realtime/types';
import { contrastTextColor } from '../live-price';
import { useLivePrice } from './useLivePrice';

const FRAME_MS = 16;

function fakes(seriesOptions = { priceLineVisible: true, lastValueVisible: true }) {
  const line = { applyOptions: vi.fn() };
  const series = {
    createPriceLine: vi.fn(() => line),
    removePriceLine: vi.fn(),
    applyOptions: vi.fn(),
    options: vi.fn(() => seriesOptions),
    priceToCoordinate: vi.fn((): number | null => 100),
  };
  const size = { scaleWidth: 56, paneHeight: 300 };
  const chart = {
    options: () => ({ layout: { fontSize: 12 } }),
    priceScale: () => ({ width: () => size.scaleWidth }),
    panes: () => [{ getHeight: () => size.paneHeight }],
  };
  const el = document.createElement('div');
  return {
    line,
    series,
    size,
    el,
    refs: {
      chartRef: { current: chart as unknown as IChartApi },
      candlestickSeriesRef: { current: series as unknown as ISeriesApi<'Candlestick'> },
      countdownRef: { current: el },
    },
  };
}

const live: LiveState = { price: 101, reference: 100, barCloseAt: 300_000, state: 'live' };
const shown = (el: HTMLElement) => el.style.display !== 'none';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(1_000);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), FRAME_MS));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useLivePrice', () => {
  it('does nothing to the series without live, and schedules nothing', () => {
    const f = fakes();
    const h = renderHook(() => useLivePrice({ ...f.refs, live: null, theme: DEFAULT_CHART_THEME }));
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);
    h.unmount();
    expect(f.series.applyOptions).not.toHaveBeenCalled();
    expect(f.series.createPriceLine).not.toHaveBeenCalled();
    expect(f.series.removePriceLine).not.toHaveBeenCalled();
    expect(shown(f.el)).toBe(false);
    expect(f.el.textContent).toBe('');
  });

  it('draws a price line with axis tag and the countdown, and hides the series last-value line', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live, theme: DEFAULT_CHART_THEME }));
    expect(f.series.applyOptions).toHaveBeenCalledWith({ priceLineVisible: false, lastValueVisible: false });
    expect(f.series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({ price: 101, color: DEFAULT_CHART_THEME.upColor, axisLabelVisible: true }),
    );
    expect(f.el.textContent).toBe('4:59');
    expect(f.el.style.top).toBe('109px');
    expect(f.el.style.width).toBe('56px');
    expect(f.el.style.color).toBe('rgb(0, 0, 0)');
    expect(shown(f.el)).toBe(true);
  });

  it('moves and recolors the line on a new price, and ticks the countdown', () => {
    const f = fakes();
    const h = renderHook((p: { live: LiveState }) => useLivePrice({ ...f.refs, live: p.live, theme: DEFAULT_CHART_THEME }), {
      initialProps: { live },
    });
    h.rerender({ live: { ...live, price: 99 } });
    expect(f.series.createPriceLine).toHaveBeenCalledTimes(1);
    expect(f.line.applyOptions).toHaveBeenCalledWith({ price: 99, color: DEFAULT_CHART_THEME.downColor });
    vi.advanceTimersByTime(2_000);
    expect(f.el.textContent).toBe('4:57');
  });

  it('recolors the line when the theme changes', () => {
    const f = fakes();
    const h = renderHook((p: { theme: typeof DEFAULT_CHART_THEME }) => useLivePrice({ ...f.refs, live, theme: p.theme }), {
      initialProps: { theme: DEFAULT_CHART_THEME },
    });
    h.rerender({ theme: { ...DEFAULT_CHART_THEME, livePriceUpColor: '#123456' } });
    expect(f.line.applyOptions).toHaveBeenLastCalledWith({ price: 101, color: '#123456' });
    expect(f.el.style.color).toBe('rgb(255, 255, 255)');
  });

  it('follows the price axis on the next frame without a new tick', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live, theme: DEFAULT_CHART_THEME }));
    f.series.priceToCoordinate.mockReturnValue(200);
    f.size.scaleWidth = 64;
    vi.advanceTimersByTime(FRAME_MS);
    expect(f.el.style.top).toBe('209px');
    expect(f.el.style.width).toBe('64px');
  });

  it('hides the countdown when the price is off the pane or the scale has no width', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live, theme: DEFAULT_CHART_THEME }));
    f.series.priceToCoordinate.mockReturnValue(-5);
    vi.advanceTimersByTime(FRAME_MS);
    expect(shown(f.el)).toBe(false);
    f.series.priceToCoordinate.mockReturnValue(290);
    vi.advanceTimersByTime(FRAME_MS);
    expect(shown(f.el)).toBe(false);
    f.series.priceToCoordinate.mockReturnValue(null);
    vi.advanceTimersByTime(FRAME_MS);
    expect(shown(f.el)).toBe(false);
    f.series.priceToCoordinate.mockReturnValue(100);
    vi.advanceTimersByTime(FRAME_MS);
    expect(shown(f.el)).toBe(true);
    f.size.scaleWidth = 0;
    vi.advanceTimersByTime(FRAME_MS);
    expect(shown(f.el)).toBe(false);
  });

  it('holds 0:00 once the bar is overdue', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live, theme: DEFAULT_CHART_THEME }));
    vi.advanceTimersByTime(400_000);
    expect(f.el.textContent).toBe('0:00');
    expect(shown(f.el)).toBe(true);
  });

  it('removes the line, restores the series options it found, and stops the loop when live goes away', () => {
    const f = fakes({ priceLineVisible: false, lastValueVisible: true });
    const h = renderHook((p: { live: LiveState | null }) => useLivePrice({ ...f.refs, live: p.live, theme: DEFAULT_CHART_THEME }), {
      initialProps: { live } as { live: LiveState | null },
    });
    h.rerender({ live: null });
    expect(f.series.removePriceLine).toHaveBeenCalledTimes(1);
    expect(f.series.applyOptions).toHaveBeenLastCalledWith({ priceLineVisible: false, lastValueVisible: true });
    expect(shown(f.el)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops the interval and frame loop on unmount while live is set', () => {
    const f = fakes();
    const h = renderHook(() => useLivePrice({ ...f.refs, live, theme: DEFAULT_CHART_THEME }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    h.unmount();
    expect(vi.getTimerCount()).toBe(0);
    f.series.priceToCoordinate.mockClear();
    vi.advanceTimersByTime(5_000);
    expect(f.el.textContent).toBe('4:59');
    expect(f.series.priceToCoordinate).not.toHaveBeenCalled();
  });

  it('draws a fresh line on a recreated series without touching the old one', () => {
    const f = fakes();
    const h = renderHook((p: { live: LiveState }) => useLivePrice({ ...f.refs, live: p.live, theme: DEFAULT_CHART_THEME }), {
      initialProps: { live },
    });
    const second = fakes();
    f.refs.candlestickSeriesRef.current = second.refs.candlestickSeriesRef.current;
    h.rerender({ live: { ...live, price: 102 } });
    expect(f.series.removePriceLine).not.toHaveBeenCalled();
    expect(second.series.applyOptions).toHaveBeenCalledWith({ priceLineVisible: false, lastValueVisible: false });
    expect(second.series.createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ price: 102 }));
  });

  it('hides the countdown on daily and runs no loop', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live: { ...live, barCloseAt: null }, theme: DEFAULT_CHART_THEME }));
    expect(f.series.createPriceLine).toHaveBeenCalledTimes(1);
    expect(shown(f.el)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fires onLiveStateChange once per transition', () => {
    const f = fakes();
    const onLiveStateChange = vi.fn();
    const h = renderHook((p: { live: LiveState }) => useLivePrice({ ...f.refs, live: p.live, theme: DEFAULT_CHART_THEME, onLiveStateChange }), {
      initialProps: { live },
    });
    h.rerender({ live: { ...live, price: 101.5 } });
    h.rerender({ live: { ...live, state: 'stalled' } });
    h.rerender({ live: { ...live, price: 100.5, state: 'stalled' } });
    h.rerender({ live: { ...live, state: 'disconnected' } });
    expect(onLiveStateChange.mock.calls).toEqual([['live'], ['stalled'], ['disconnected']]);
  });

  it('uses the contrast helper for the countdown text', () => {
    expect(contrastTextColor(DEFAULT_CHART_THEME.upColor)).toBe('#000');
  });
});
