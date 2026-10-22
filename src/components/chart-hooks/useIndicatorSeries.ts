import { useEffect, type MutableRefObject } from 'react';
import {
  AreaSeries,
  createSeriesMarkers,
  HistogramData,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineData,
  LineSeries,
  Time,
  WhitespaceData,
} from 'lightweight-charts';
import { OHLCVBar } from '../../types/chart';
import { IndicatorDefinition, IndicatorInstance, IndicatorOutput } from '../../indicators/core/types';
import { indicatorRegistry } from '../../indicators/core/registry';
import { indicatorCalculator } from '../../indicators/core/calculator';
import { BandsPrimitive } from '../../indicators/primitives/BandsPrimitive';
import { BAND_FILL } from '../../constants/colors';
import { transformSeriesData, transformSeriesDataWithGaps } from '../transformSeriesData';
import { buildIndicatorPointMarkers, fieldColor, pointFieldsOf, resolvePointStyle } from '../indicator-points';

// Output field names of a calculated indicator point (everything but `time`).
function outputFieldKeys(point: Record<string, number>): string[] {
  return Object.keys(point).filter((k) => k !== 'time');
}

/** POINTS plugins are keyed `${instanceId}:${field}`. */
const pointsKey = (instanceId: string, field: string) => `${instanceId}:${field}`;

function setPointMarkers(
  plugins: Map<string, ISeriesMarkersPluginApi<Time>>,
  definition: IndicatorDefinition,
  indicator: IndicatorInstance,
  data: IndicatorOutput[],
): void {
  const style = resolvePointStyle(definition.renderConfig, indicator.settings);
  pointFieldsOf(definition.renderConfig, data).forEach((field, idx) => {
    plugins
      .get(pointsKey(indicator.id, field))
      ?.setMarkers(buildIndicatorPointMarkers(data, field, style, fieldColor(indicator.settings, field, idx)));
  });
}

interface UseIndicatorSeriesArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  barsRef: MutableRefObject<OHLCVBar[]>;
  indicatorSeriesRef: MutableRefObject<Map<string, ISeriesApi<any>>>;
  /**
   * POINTS indicators' markers plugins on the candlestick series, one per drawn
   * output field. Separate from the chart's trade/host markers plugin, so points
   * never replace those markers (lightweight-charts allows several per series).
   */
  indicatorMarkersRef: MutableRefObject<Map<string, ISeriesMarkersPluginApi<Time>>>;
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
  candlestickSeriesRef,
  barsRef,
  indicatorSeriesRef,
  indicatorMarkersRef,
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
    indicatorMarkersRef.current.forEach((plugin) => {
      try {
        plugin.detach();
      } catch {
        // series already disposed (chart.remove during teardown) — nothing to detach.
      }
    });
    indicatorMarkersRef.current.clear();
    indicatorPaneIndexRef.current.clear();
    nextPaneIndexRef.current = 2;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      const seriesType = definition.renderConfig.seriesType;

      // Points sit on the candles, so they are always on the price pane.
      if (seriesType === 'points') {
        const candles = candlestickSeriesRef.current;
        if (!candles) return;
        pointFieldsOf(definition.renderConfig, data).forEach((field) => {
          indicatorMarkersRef.current.set(pointsKey(indicator.id, field), createSeriesMarkers(candles, []));
        });
        setPointMarkers(indicatorMarkersRef.current, definition, indicator, data);
        return;
      }

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
            // A per-day level resets/segments over time → the full-width last-value
            // price line would misleadingly span the whole chart at the latest value.
            priceLineVisible: definition.renderConfig.priceLineVisible ?? true,
            lastValueVisible: definition.renderConfig.lastValueVisible ?? true,
          }, paneIndex);
          // Non-finite points → whitespace so the line BREAKS there (not connects):
          // warm-up renders identically, and a level that resets per day shows a clean
          // segment per day instead of one connected line across the gaps.
          const lineData = transformSeriesDataWithGaps(data, 'value');
          series.setData(lineData as (LineData | WhitespaceData)[]);
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

      if (definition.renderConfig.seriesType === 'points') {
        setPointMarkers(indicatorMarkersRef.current, definition, indicator, data);
      } else if (definition.renderConfig.outputCount === 1) {
        const series = indicatorSeriesRef.current.get(indicator.id);
        if (series) {
          // Line series break at gaps (whitespace); histogram/area keep the drop behavior.
          if (definition.renderConfig.seriesType === 'line') {
            series.setData(transformSeriesDataWithGaps(data, 'value') as (LineData | WhitespaceData)[]);
          } else {
            series.setData(transformSeriesData(data, 'value') as LineData[]);
          }
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
