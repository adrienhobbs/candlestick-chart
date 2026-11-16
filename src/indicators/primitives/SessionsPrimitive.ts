import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
  buildSessionRuns,
  detectDayBoundaries,
  type SessionsConfig,
  type SessionRun,
} from '../../sessions/sessions';

// Session shading (filled vertical regions, behind candles) + day separators (thin
// vertical lines, in front) drawn as a custom ISeriesPrimitive. lightweight-charts
// calls updateAllViews on every data change (every live tick), so that and the
// data-changed handler only mark state stale; the bar times are re-read on the first
// draw after a data change, and x-coordinates are mapped only for the runs and
// separators near the visible range. Session classification (the Intl-heavy part)
// is cached on a data/config signature and only recomputed when bars or config change.

interface SessionRectPx {
  left: number; // media-space x
  right: number;
  color: string;
}

interface SessionsViewData {
  rects: SessionRectPx[];
  separatorsX: number[]; // media-space x
  separatorColor: string;
  separatorWidthPx: number;
}

/** First index whose time is at least `time`. */
function lowerBound(times: readonly number[], time: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The items overlapping [lo, hi], plus the nearest one each side; `items` sorted by start. */
function nearWindow<T>(items: readonly T[], start: (t: T) => number, end: (t: T) => number, lo: number, hi: number): T[] {
  let a = 0;
  while (a < items.length && end(items[a]) < lo) a++;
  let b = a;
  while (b < items.length && start(items[b]) <= hi) b++;
  return items.slice(Math.max(0, a - 1), Math.min(items.length, b + 1));
}

class SessionsPaneView {
  private _source: SessionsPrimitive;

  constructor(source: SessionsPrimitive) {
    this._source = source;
  }

  renderer() {
    return new SessionsRenderer(this._source._viewData());
  }
}

class SessionsRenderer {
  private _data: SessionsViewData | null;

  constructor(data: SessionsViewData | null) {
    this._data = data;
  }

  // Session shading — behind the candles. Drawn in media space (after scaling by the
  // pixel ratios), so the full pane height is `scope.mediaSize.height`.
  drawBackground(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const data = this._data;
      if (!data || data.rects.length === 0) return;
      const ctx = scope.context;
      ctx.save();
      ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);
      const h = scope.mediaSize.height;
      for (const r of data.rects) {
        ctx.fillStyle = r.color;
        ctx.fillRect(r.left, 0, r.right - r.left, h);
      }
      ctx.restore();
    });
  }

  // Day separators — in front. Drawn unscaled in bitmap space for crisp 1px lines, so
  // x is multiplied by the pixel ratio and the height is `scope.bitmapSize.height`.
  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const data = this._data;
      if (!data || data.separatorsX.length === 0 || !data.separatorColor) return;
      const ctx = scope.context;
      ctx.save();
      ctx.fillStyle = data.separatorColor;
      const w = Math.max(1, Math.round(data.separatorWidthPx * scope.horizontalPixelRatio));
      const h = scope.bitmapSize.height;
      for (const xMedia of data.separatorsX) {
        const xb = Math.round(xMedia * scope.horizontalPixelRatio);
        ctx.fillRect(xb, 0, w, h);
      }
      ctx.restore();
    });
  }
}

export class SessionsPrimitive implements ISeriesPrimitive<Time> {
  _chart: IChartApi | null = null;
  _series: ISeriesApi<'Candlestick'> | null = null;
  _config: SessionsConfig;
  /** Bumped on every applyOptions so the classification cache invalidates. */
  _configVersion = 0;
  private _requestUpdate: (() => void) | null = null;
  private _paneViews: SessionsPaneView[];
  /** Bar times in seconds; null when the series data changed since they were read. */
  private _timesSec: number[] | null = null;
  // Index-space classification, cached on a cheap signature so Intl only runs on change.
  private _runs: SessionRun[] = [];
  private _boundaries: number[] = [];
  private _sig = '';
  private _view: SessionsViewData | null = null;
  private _viewStale = true;
  private readonly _onDataChanged = () => {
    this._timesSec = null;
    this._viewStale = true;
  };

  constructor(config: SessionsConfig) {
    this._config = config;
    this._paneViews = [new SessionsPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<'Candlestick'>;
    this._requestUpdate = param.requestUpdate;
    this._series.subscribeDataChanged(this._onDataChanged);
    this._onDataChanged();
  }

  detached(): void {
    this._series?.unsubscribeDataChanged(this._onDataChanged);
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._timesSec = null;
    this._view = null;
  }

  /** Update the live config (timezone / sessions / separators) and schedule a redraw. */
  applyOptions(config: SessionsConfig): void {
    this._config = config;
    this._configVersion += 1; // invalidates the classification cache
    this._viewStale = true;
    this._requestUpdate?.();
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._viewStale = true;
  }

  /** What to draw for the current view; recomputed only after a view update, data or config change. */
  _viewData(): SessionsViewData | null {
    if (!this._viewStale) return this._view;
    this._viewStale = false;
    this._view = this._computeView();
    return this._view;
  }

  private _computeView(): SessionsViewData | null {
    const chart = this._chart;
    const series = this._series;
    const config = this._config;
    if (!chart || !series || !config) return null;

    if (this._timesSec === null) {
      this._timesSec = (series.data() as ReadonlyArray<{ time: number }>).map((d) => d.time as number);
    }
    const timesSec = this._timesSec;
    if (timesSec.length === 0) return null;

    // Recompute classification only when the bar set or config changes.
    const sig = `${this._configVersion}:${timesSec.length}:${timesSec[0]}:${timesSec[timesSec.length - 1]}`;
    if (sig !== this._sig) {
      const timesMs = timesSec.map((t) => t * 1000);
      this._runs = buildSessionRuns(timesMs, config);
      this._boundaries = config.separatorColor ? detectDayBoundaries(timesMs, config) : [];
      this._sig = sig;
    }

    const separatorColor = config.separatorColor ?? '';
    const separatorWidthPx = config.separatorWidthPx ?? 1;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleRange();
    if (range === null) return { rects: [], separatorsX: [], separatorColor, separatorWidthPx };

    // Bar indices of the visible range, widened by a bar each side; the nearest run
    // and separator beyond it are kept too, so nothing on screen is dropped.
    const lo = lowerBound(timesSec, range.from as number) - 1;
    const hi = lowerBound(timesSec, (range.to as number) + 1e-9);

    const halfBar = timeScale.options().barSpacing / 2;
    const coordAt = (idx: number): number | null => {
      const c = timeScale.timeToCoordinate(timesSec[idx] as Time);
      return c === null ? null : (c as number);
    };

    const shaded = this._runs.filter((run) => {
      if (run.sessionIndex < 0) return false;
      const color = config.sessions[run.sessionIndex]?.color;
      return Boolean(color) && color !== 'transparent';
    });
    const rects: SessionRectPx[] = [];
    for (const run of nearWindow(shaded, (r) => r.startIdx, (r) => r.endIdx, lo, hi)) {
      const color = config.sessions[run.sessionIndex].color;
      const xs = coordAt(run.startIdx);
      const xe = coordAt(run.endIdx);
      if (xs === null || xe === null) continue;
      rects.push({ left: xs - halfBar, right: xe + halfBar, color });
    }

    const separatorsX: number[] = [];
    for (const idx of nearWindow(this._boundaries, (i) => i, (i) => i, lo, hi)) {
      const x = coordAt(idx);
      if (x === null) continue;
      separatorsX.push(x - halfBar); // sits at the left edge of the new day's first bar
    }

    return { rects, separatorsX, separatorColor, separatorWidthPx };
  }
}
