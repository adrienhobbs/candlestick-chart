import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { buildOhlcLegendData, type OhlcLegendData, type OhlcLegendIndicator } from '../ohlcLegendData';
import type { OHLCVBar } from '../../types/chart';

interface UseOhlcLegendArgs {
  enabled: boolean;
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  volumeSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>;
  indicatorSeriesRef: MutableRefObject<Map<string, ISeriesApi<any>>>;
  barsRef: MutableRefObject<OHLCVBar[]>;
  /** The currently-selected bar; the legend follows it when the cursor is idle. */
  selectedBar: OHLCVBar | null;
  // Used only to retrigger the idle readout when the data/indicator/selection changes.
  bars: OHLCVBar[];
  indicators: unknown[];
}

/**
 * Drive the crosshair OHLC legend: on crosshair move, read O/H/L/C from the candlestick
 * series, volume from the volume series, and each indicator's value from the hovered
 * point. When the cursor is idle, follow the **selected bar** if there is one (so
 * arrow-key/click navigation updates the legend), otherwise the last bar. Returns the
 * current legend data (or null when disabled / no data).
 */
export function useOhlcLegend({
  enabled,
  chartRef,
  candlestickSeriesRef,
  volumeSeriesRef,
  indicatorSeriesRef,
  barsRef,
  selectedBar,
  bars,
  indicators,
}: UseOhlcLegendArgs): OhlcLegendData | null {
  const [data, setData] = useState<OhlcLegendData | null>(null);
  const hoveringRef = useRef(false);
  // Read inside the once-registered crosshair closure without going stale.
  const selectedBarRef = useRef(selectedBar);
  selectedBarRef.current = selectedBar;

  // Build indicator rows via a per-series value getter (hover vs idle differ only there).
  const readIndicators = (getValue: (s: ISeriesApi<any>) => number | undefined): OhlcLegendIndicator[] => {
    const out: OhlcLegendIndicator[] = [];
    for (const [, series] of indicatorSeriesRef.current) {
      const value = getValue(series);
      if (value === undefined || !Number.isFinite(value)) continue;
      const opts = series.options() as { title?: string; color?: string };
      out.push({ label: opts.title || '', color: opts.color || '#888888', value });
    }
    return out;
  };

  // Build legend data for a specific bar: OHLCV from the bar, indicator values looked
  // up by matching time in each indicator series.
  const computeForBar = (bar: OHLCVBar | undefined): OhlcLegendData | null => {
    if (!bar) return null;
    const t = bar.timestamp / 1000;
    const indicatorRows = readIndicators((s) => {
      const pt = s.data().find((d) => (d as { time?: number }).time === t) as { value?: number } | undefined;
      return pt?.value;
    });
    return buildOhlcLegendData({
      time: t,
      ohlc: { open: bar.open, high: bar.high, low: bar.low, close: bar.close },
      volume: bar.volume,
      indicators: indicatorRows,
    });
  };

  // Idle = the selected bar if any, else the last bar.
  const computeIdle = (): OhlcLegendData | null =>
    computeForBar(selectedBarRef.current ?? barsRef.current[barsRef.current.length - 1]);

  // Crosshair subscription (chart is created by useChartLifecycle, which runs first).
  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    const chart = chartRef.current;
    if (!chart) return;
    const onMove = (param: MouseEventParams) => {
      if (param.time === undefined) {
        hoveringRef.current = false;
        setData(computeIdle());
        return;
      }
      hoveringRef.current = true;
      const candleRaw = candlestickSeriesRef.current
        ? (param.seriesData.get(candlestickSeriesRef.current) as { open?: number; high?: number; low?: number; close?: number } | undefined)
        : undefined;
      const ohlc =
        candleRaw && candleRaw.open !== undefined
          ? { open: candleRaw.open, high: candleRaw.high!, low: candleRaw.low!, close: candleRaw.close! }
          : null;
      const volume = volumeSeriesRef.current
        ? (param.seriesData.get(volumeSeriesRef.current) as { value?: number } | undefined)?.value ?? null
        : null;
      const indicatorRows = readIndicators(
        (s) => (param.seriesData.get(s) as { value?: number } | undefined)?.value,
      );
      setData(buildOhlcLegendData({ time: param.time as number, ohlc, volume, indicators: indicatorRows }));
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Initial + idle refresh on bars/indicators/selection change (skip while hovering).
  useEffect(() => {
    if (!enabled) return;
    if (!hoveringRef.current) setData(computeIdle());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, bars, indicators, selectedBar]);

  return enabled ? data : null;
}
