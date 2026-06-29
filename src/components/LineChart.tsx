import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  LineSeries,
  LineStyle,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type LineWidth,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import type { ChartTheme } from '../types/chart';
import { buildBaseChartLayoutOptions, resolveChartTheme } from '../utils/chartTheme';

/** One line in a {@link LineChart}. */
export interface LineChartSeries {
  /** Stable identity (used to reconcile series across renders). */
  id: string;
  /** Legend label; falls back to `id`. */
  label?: string;
  color: string;
  /** Line thickness (default 2). */
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /**
   * Points as `{ x, y }` where **x is an ordinal index** (e.g. trade #), not a
   * timestamp. x must be ascending + unique per series (sorted/deduped defensively).
   */
  data: { x: number; y: number }[];
}

export interface LineChartProps {
  /** Series to overlay on one shared pane; later entries draw on top. */
  series: LineChartSeries[];
  /** Partial chart theme (candle/volume fields are ignored). Re-applied live. */
  theme?: Partial<ChartTheme>;
  /** Fixed height in px; omit to fill the container (observed via ResizeObserver). */
  height?: number;
  /** Draw a dashed horizontal reference line at this value (e.g. `0`) and keep it in view. */
  baseline?: number;
  /** Format an ordinal x for axis ticks + the crosshair label (default `String(x)`). */
  xTickFormatter?: (x: number) => string;
  /** Format a y value for the price axis, legend, and hover readout (default `String(y)`). */
  valueFormatter?: (y: number) => string;
  /** Show the overlay legend (color swatch + label + value). Default true. */
  showLegend?: boolean;
}

function styleToLineStyle(style?: 'solid' | 'dashed' | 'dotted'): LineStyle {
  switch (style) {
    case 'dashed':
      return LineStyle.Dashed;
    case 'dotted':
      return LineStyle.Dotted;
    default:
      return LineStyle.Solid;
  }
}

// Ordinal {x,y} → LWC LineData: x becomes an integer `time`, sorted ascending,
// deduped by x (last wins), and NaN-filtered — all three are LWC requirements.
function toLineData(points: { x: number; y: number }[]): LineData[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const out: LineData[] = [];
  let lastX = Number.NaN;
  for (const p of sorted) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const point = { time: p.x as Time, value: p.y };
    if (p.x === lastX) out[out.length - 1] = point;
    else {
      out.push(point);
      lastX = p.x;
    }
  }
  return out;
}

/**
 * Overlay several line series on one shared pane for comparison — e.g. per-split
 * equity curves aligned at trade #0.
 *
 * NOTE: the x-axis is **ordinal, not time**. candlekit sits on lightweight-charts
 * (a time-series chart), so we feed the integer ordinal as the `time` field and
 * override the tick/crosshair formatters to render it as an ordinal. Don't "fix"
 * this into real timestamps — the data has no time dimension.
 */
export default function LineChart({
  series,
  theme,
  height,
  baseline,
  xTickFormatter,
  valueFormatter,
  showLegend = true,
}: LineChartProps) {
  const resolvedTheme = useMemo(() => resolveChartTheme(theme), [theme]);
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const baselineLineRef = useRef<IPriceLine | null>(null);
  const baselineOwnerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const didFitRef = useRef(false);
  const heightRef = useRef(height);
  heightRef.current = height;

  // Formatters are read through refs so the create-once chart's installed
  // formatter closures always reflect the latest prop (no re-apply needed).
  const xFmt = xTickFormatter ?? ((x: number) => String(x));
  const vFmt = valueFormatter ?? ((y: number) => String(y));
  const xFmtRef = useRef(xFmt);
  xFmtRef.current = xFmt;
  const vFmtRef = useRef(vFmt);
  vFmtRef.current = vFmt;

  const [hover, setHover] = useState<{ x: number; values: Record<string, number | undefined> } | null>(null);

  // Create-once: chart + resize + crosshair subscription.
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.position = 'relative';

    const base = buildBaseChartLayoutOptions(themeRef.current);
    const chart = createChart(containerRef.current, {
      ...base,
      localization: {
        timeFormatter: (time: Time) => xFmtRef.current(time as number),
        priceFormatter: (price: number) => vFmtRef.current(price),
      },
      width: containerRef.current.clientWidth,
      height: heightRef.current ?? (containerRef.current.clientHeight || 300),
      timeScale: {
        ...base.timeScale,
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (time: Time) => xFmtRef.current(time as number),
      },
    });
    chartRef.current = chart;

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const next = heightRef.current ?? containerRef.current.clientHeight;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        ...(heightRef.current === undefined && next > 0 ? { height: next } : {}),
        ...(heightRef.current !== undefined ? { height: heightRef.current } : {}),
      });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    const onCrosshairMove = (param: MouseEventParams) => {
      if (param.time === undefined) {
        setHover(null);
        return;
      }
      const values: Record<string, number | undefined> = {};
      for (const [id, s] of lineSeriesRef.current) {
        values[id] = (param.seriesData.get(s) as LineData | undefined)?.value;
      }
      setHover({ x: param.time as number, values });
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      // Drop stale refs — a StrictMode double-mount would otherwise re-run the
      // reconcile effect and call removeSeries on series this disposed chart owned.
      lineSeriesRef.current.clear();
      baselineLineRef.current = null;
      baselineOwnerRef.current = null;
      didFitRef.current = false;
    };
  }, []);

  // Apply an explicit height change (the create-once effect can't).
  useEffect(() => {
    if (chartRef.current && height !== undefined) chartRef.current.applyOptions({ height });
  }, [height]);

  // Reconcile line series + baseline when `series`/`baseline` change.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const map = lineSeriesRef.current;
    const incoming = new Set(series.map((s) => s.id));

    // Remove series no longer present.
    for (const [id, s] of [...map]) {
      if (!incoming.has(id)) {
        chart.removeSeries(s);
        map.delete(id);
      }
    }

    // Upsert in array order so later series draw on top.
    series.forEach((s, idx) => {
      const data = toLineData(s.data);
      const existing = map.get(s.id);
      if (existing) {
        existing.applyOptions({
          color: s.color,
          lineWidth: (s.lineWidth ?? 2) as LineWidth,
          lineStyle: styleToLineStyle(s.lineStyle),
          title: s.label ?? s.id,
        });
        existing.setData(data);
        return;
      }
      // Anchor series (first) carries the baseline-into-range autoscale so a
      // y=0 line stays visible even when all curves are strictly positive.
      const anchorsBaseline = baseline != null && idx === 0;
      const created = chart.addSeries(
        LineSeries,
        {
          color: s.color,
          lineWidth: (s.lineWidth ?? 2) as LineWidth,
          lineStyle: styleToLineStyle(s.lineStyle),
          title: s.label ?? s.id,
          lastValueVisible: true,
          priceLineVisible: false,
          ...(anchorsBaseline
            ? {
                autoscaleInfoProvider: (orig: () => AutoscaleInfo | null): AutoscaleInfo | null => {
                  const r = orig();
                  if (!r || !r.priceRange) return r;
                  return {
                    ...r,
                    priceRange: {
                      minValue: Math.min(r.priceRange.minValue, baseline as number),
                      maxValue: Math.max(r.priceRange.maxValue, baseline as number),
                    },
                  };
                },
              }
            : {}),
        },
        0,
      );
      created.setData(data);
      map.set(s.id, created);
    });

    // Rebuild the baseline price line (owned by — and disposed with — its series).
    if (baselineLineRef.current && baselineOwnerRef.current) {
      try {
        baselineOwnerRef.current.removePriceLine(baselineLineRef.current);
      } catch {
        // owner already disposed; ignore
      }
      baselineLineRef.current = null;
      baselineOwnerRef.current = null;
    }
    if (baseline != null && series.length > 0) {
      const owner = map.get(series[0].id);
      if (owner) {
        baselineLineRef.current = owner.createPriceLine({
          price: baseline,
          color: themeRef.current.crosshairColor,
          lineWidth: 1 as LineWidth,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: vFmtRef.current(baseline),
        });
        baselineOwnerRef.current = owner;
      }
    }

    // Frame everything on the first non-empty data, then leave the view alone.
    if (!didFitRef.current && series.some((s) => s.data.length > 0)) {
      chart.timeScale().fitContent();
      didFitRef.current = true;
    }
  }, [series, baseline]);

  // Live re-theme (no recreate).
  useEffect(() => {
    chartRef.current?.applyOptions(buildBaseChartLayoutOptions(resolvedTheme));
  }, [resolvedTheme]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: height ? `${height}px` : '100%' }}>
      {showLegend && series.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 8,
            zIndex: 3,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '4px 6px',
            fontSize: 11,
            lineHeight: 1.4,
            fontFamily: resolvedTheme.fontFamily,
            color: resolvedTheme.textColor,
            background: resolvedTheme.background,
            border: `1px solid ${resolvedTheme.axisBorderColor}`,
          }}
        >
          {hover && <div style={{ opacity: 0.7 }}>{xFmtRef.current(hover.x)}</div>}
          {series.map((s) => {
            const hovered = hover?.values?.[s.id];
            const final = s.data.length ? s.data[s.data.length - 1].y : undefined;
            const shown = hovered !== undefined ? hovered : final;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 2, background: s.color, display: 'inline-block', flex: '0 0 auto' }} />
                <span>{s.label ?? s.id}</span>
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {shown != null ? vFmtRef.current(shown) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
