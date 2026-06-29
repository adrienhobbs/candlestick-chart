import { useEffect, type MutableRefObject } from 'react';
import {
  AreaSeries,
  HistogramData,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineData,
  LineSeries,
} from 'lightweight-charts';
import { OHLCVBar } from '../../types/chart';
import { IndicatorInstance } from '../../indicators/core/types';
import { indicatorRegistry } from '../../indicators/core/registry';
import { indicatorCalculator } from '../../indicators/core/calculator';
import { BandsPrimitive } from '../../indicators/primitives/BandsPrimitive';
import { PALETTE, BAND_FILL } from '../../constants/colors';
import { transformSeriesData } from '../transformSeriesData';

// Palette for multi-output indicators whose fields lack an explicit color setting.
const MULTI_LINE_PALETTE = PALETTE;

// Color for a named output field of a multi-output indicator: prefer an explicit
// `<field>Color` setting, fall back to the generic `color` for the primary
// `value` series, else a stable palette slot.
function fieldColor(settings: Record<string, any>, key: string, idx: number): string {
  return (
    settings[`${key}Color`] ||
    (key === 'value' ? settings.color : undefined) ||
    MULTI_LINE_PALETTE[idx % MULTI_LINE_PALETTE.length]
  );
}

// Output field names of a calculated indicator point (everything but `time`).
function outputFieldKeys(point: Record<string, number>): string[] {
  return Object.keys(point).filter((k) => k !== 'time');
}

interface UseIndicatorSeriesArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  barsRef: MutableRefObject<OHLCVBar[]>;
  indicatorSeriesRef: MutableRefObject<Map<string, ISeriesApi<any>>>;
  indicatorPaneIndexRef: MutableRefObject<Map<string, number>>;
  nextPaneIndexRef: MutableRefObject<number>;
  indicators: IndicatorInstance[];
  bars: OHLCVBar[];
}

/**
 * Build/refresh indicator series. The setup effect (deps `[indicators]`)
 * recreates every series when the indicator set changes; the update effect
 * (deps `[bars, indicators]`) re-feeds data so series track lazily-loaded bars.
 * The series + pane-index refs are passed in (shared with the create-once
 * teardown, which clears them for StrictMode's double-mount).
 */
export function useIndicatorSeries({
  chartRef,
  barsRef,
  indicatorSeriesRef,
  indicatorPaneIndexRef,
  nextPaneIndexRef,
  indicators,
  bars,
}: UseIndicatorSeriesArgs) {
  useEffect(() => {
    if (!chartRef.current) return;

    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    indicatorSeriesRef.current.clear();
    indicatorPaneIndexRef.current.clear();
    nextPaneIndexRef.current = 2;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      const seriesType = definition.renderConfig.seriesType;
      const isOverlay = definition.renderConfig.overlay !== false;
      const paneIndex = isOverlay ? 0 : nextPaneIndexRef.current;

      if (!isOverlay) {
        indicatorPaneIndexRef.current.set(indicator.id, paneIndex);
        nextPaneIndexRef.current++;
      }

      if (seriesType === 'line') {
        if (definition.renderConfig.outputCount === 1) {
          const series = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.color || '#3b82f6',
            lineWidth: indicator.settings.lineWidth || 2,
            title: indicator.name,
          }, paneIndex);
          // Drop warm-up / undefined points (e.g. an EMA's first `period` bars);
          // lightweight-charts rejects NaN/non-finite line values.
          const lineData = transformSeriesData(data, 'value');
          series.setData(lineData as LineData[]);
          indicatorSeriesRef.current.set(indicator.id, series);
        } else if (definition.renderConfig.hasBandFill && definition.renderConfig.fillBands) {
          const { upper: upperField, lower: lowerField } = definition.renderConfig.fillBands;

          const upperSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.upperColor || '#ef4444',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Upper`,
          }, paneIndex);
          const middleSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.middleColor || indicator.settings.vwapColor || '#3b82f6',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Middle`,
          }, paneIndex);
          const lowerSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.lowerColor || '#10b981',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Lower`,
          }, paneIndex);

          const upperData = transformSeriesData(data, upperField, (v) => !isNaN(v));
          const middleData = transformSeriesData(data, 'value', (v) => !isNaN(v));
          const lowerData = transformSeriesData(data, lowerField, (v) => !isNaN(v));

          upperSeries.setData(upperData as LineData[]);
          middleSeries.setData(middleData as LineData[]);
          lowerSeries.setData(lowerData as LineData[]);

          if (indicator.settings.showFill !== false) {
            const bandsPrimitive = new BandsPrimitive({
              upperSeries: upperSeries,
              lowerSeries: lowerSeries,
              fillColor: indicator.settings.fillColor || BAND_FILL,
            });
            upperSeries.attachPrimitive(bandsPrimitive);
          }

          indicatorSeriesRef.current.set(`${indicator.id}-upper`, upperSeries);
          indicatorSeriesRef.current.set(`${indicator.id}-middle`, middleSeries);
          indicatorSeriesRef.current.set(`${indicator.id}-lower`, lowerSeries);
        } else {
          // Generic multi-output line indicator with no band fill (MACD,
          // Stochastic, StochRSI, Ichimoku, …): one series per output field.
          // A field literally named "histogram" renders as a histogram column;
          // every other numeric field renders as a line. Keyed `${id}-${field}`
          // so the bars-change effect can update each one.
          outputFieldKeys(data[0]).forEach((key, idx) => {
            const points = transformSeriesData(data, key);
            const title = key === 'value' ? indicator.name : `${indicator.name} ${key}`;
            const series =
              key === 'histogram'
                ? chartRef.current!.addSeries(
                    HistogramSeries,
                    { color: fieldColor(indicator.settings, key, idx), title },
                    paneIndex,
                  )
                : chartRef.current!.addSeries(
                    LineSeries,
                    {
                      color: fieldColor(indicator.settings, key, idx),
                      lineWidth: indicator.settings.lineWidth || 2,
                      title,
                    },
                    paneIndex,
                  );
            series.setData(points as (LineData | HistogramData)[]);
            indicatorSeriesRef.current.set(`${indicator.id}-${key}`, series);
          });
        }
      } else if (seriesType === 'histogram') {
        const series = chartRef.current!.addSeries(HistogramSeries, {
          color: indicator.settings.color || '#8b5cf6',
          title: indicator.name,
        }, paneIndex);
        const histData = transformSeriesData(data, 'value');
        series.setData(histData as HistogramData[]);
        indicatorSeriesRef.current.set(indicator.id, series);
      } else if (seriesType === 'area') {
        const series = chartRef.current!.addSeries(AreaSeries, {
          topColor: indicator.settings.topColor || '#3b82f680',
          bottomColor: indicator.settings.bottomColor || '#3b82f600',
          lineColor: indicator.settings.lineColor || '#3b82f6',
          lineWidth: indicator.settings.lineWidth || 2,
          title: indicator.name,
        }, paneIndex);
        const areaData = transformSeriesData(data, 'value');
        series.setData(areaData as LineData[]);
        indicatorSeriesRef.current.set(indicator.id, series);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators]);

  useEffect(() => {
    if (!chartRef.current || indicators.length === 0) return;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      if (definition.renderConfig.outputCount === 1) {
        const series = indicatorSeriesRef.current.get(indicator.id);
        if (series) {
          const lineData = transformSeriesData(data, 'value');
          series.setData(lineData as LineData[]);
        }
      } else if (definition.renderConfig.hasBandFill && definition.renderConfig.fillBands) {
        const { upper: upperField, lower: lowerField } = definition.renderConfig.fillBands;

        const upperSeries = indicatorSeriesRef.current.get(`${indicator.id}-upper`);
        const middleSeries = indicatorSeriesRef.current.get(`${indicator.id}-middle`);
        const lowerSeries = indicatorSeriesRef.current.get(`${indicator.id}-lower`);

        if (upperSeries && middleSeries && lowerSeries) {
          const upperData = transformSeriesData(data, upperField, (v) => !isNaN(v));
          const middleData = transformSeriesData(data, 'value', (v) => !isNaN(v));
          const lowerData = transformSeriesData(data, lowerField, (v) => !isNaN(v));

          upperSeries.setData(upperData as LineData[]);
          middleSeries.setData(middleData as LineData[]);
          lowerSeries.setData(lowerData as LineData[]);
        }
      } else {
        // Generic multi-output indicator (mirrors the setup branch): refresh each
        // per-field series so MACD/Stochastic/etc. track lazily-loaded bars.
        outputFieldKeys(data[0]).forEach((key) => {
          const series = indicatorSeriesRef.current.get(`${indicator.id}-${key}`);
          if (!series) return;
          const points = transformSeriesData(data, key);
          series.setData(points as LineData[]);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, indicators]);
}
