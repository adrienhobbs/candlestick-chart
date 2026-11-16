import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { DEFAULT_CHART_THEME } from '../../utils/chartTheme';
import type { LiveState } from '../../realtime/types';
import { useLivePrice } from './useLivePrice';

function fakes() {
  const line = { applyOptions: vi.fn() };
  const series = {
    createPriceLine: vi.fn(() => line),
    removePriceLine: vi.fn(),
    applyOptions: vi.fn(),
    priceToCoordinate: vi.fn(() => 100),
  };
  const timeScale = { subscribeVisibleLogicalRangeChange: vi.fn(), unsubscribeVisibleLogicalRangeChange: vi.fn() };
  const chart = { priceScale: () => ({ width: () => 56 }), timeScale: () => timeScale };
  const el = document.createElement('div');
  el.style.display = 'none';
  return {
    line,
    series,
    timeScale,
    el,
    refs: {
      chartRef: { current: chart as unknown as IChartApi },
      candlestickSeriesRef: { current: series as unknown as ISeriesApi<'Candlestick'> },
      countdownRef: { current: el },
    },
  };
}

const live: LiveState = { price: 101, reference: 100, barCloseAt: 300_000, state: 'live' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
});
afterEach(() => vi.useRealTimers());

describe('useLivePrice', () => {
  it('does nothing to the series without live', () => {
    const f = fakes();
    const h = renderHook(() => useLivePrice({ ...f.refs, live: null, theme: DEFAULT_CHART_THEME }));
    vi.advanceTimersByTime(5_000);
    h.unmount();
    expect(f.series.applyOptions).not.toHaveBeenCalled();
    expect(f.series.createPriceLine).not.toHaveBeenCalled();
    expect(f.series.removePriceLine).not.toHaveBeenCalled();
    expect(f.timeScale.subscribeVisibleLogicalRangeChange).not.toHaveBeenCalled();
    expect(f.el.style.display).toBe('none');
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
    expect(f.el.style.display).toBe('block');
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

  it('holds 0:00 once the bar is overdue', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live, theme: DEFAULT_CHART_THEME }));
    vi.advanceTimersByTime(400_000);
    expect(f.el.textContent).toBe('0:00');
    expect(f.el.style.display).toBe('block');
  });

  it('removes the line and restores the series line when live goes away', () => {
    const f = fakes();
    const h = renderHook((p: { live: LiveState | null }) => useLivePrice({ ...f.refs, live: p.live, theme: DEFAULT_CHART_THEME }), {
      initialProps: { live } as { live: LiveState | null },
    });
    h.rerender({ live: null });
    expect(f.series.removePriceLine).toHaveBeenCalledTimes(1);
    expect(f.series.applyOptions).toHaveBeenLastCalledWith({ priceLineVisible: true, lastValueVisible: true });
    expect(f.el.style.display).toBe('none');
    expect(f.timeScale.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalledTimes(1);
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

  it('hides the countdown on daily', () => {
    const f = fakes();
    renderHook(() => useLivePrice({ ...f.refs, live: { ...live, barCloseAt: null }, theme: DEFAULT_CHART_THEME }));
    expect(f.series.createPriceLine).toHaveBeenCalledTimes(1);
    expect(f.el.style.display).toBe('none');
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
});
