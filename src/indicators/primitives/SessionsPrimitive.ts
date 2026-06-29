import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import {
  buildSessionRuns,
  detectDayBoundaries,
  type SessionsConfig,
  type SessionRun,
} from '../../sessions/sessions';

// Session shading (filled vertical regions, behind candles) + day separators (thin
// vertical lines, in front) drawn as a custom ISeriesPrimitive. Session classification
// (the Intl-heavy part) is cached on a data/config signature and only recomputed when
// bars or config change; x-coordinates are remapped every frame (cheap).

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

class SessionsPaneView {
  private _source: SessionsPrimitive;
  private _data: SessionsViewData | null = null;
  // Index-space classification, cached on a cheap signature so Intl only runs on change.
  private _runs: SessionRun[] = [];
  private _boundaries: number[] = [];
  private _sig = '';

  constructor(source: SessionsPrimitive) {
    this._source = source;
  }

  update() {
    const chart = this._source._chart;
    const series = this._source._series;
    const config = this._source._config;
    if (!chart || !series || !config) {
      this._data = null;
      return;
    }

    const seriesData = series.data() as ReadonlyArray<{ time: number }>;
    if (seriesData.length === 0) {
      this._data = null;
      return;
    }
    const timesSec = seriesData.map((d) => d.time as number);

    // Recompute classification only when the bar set or config changes.
    const sig = `${this._source._configVersion}:${timesSec.length}:${timesSec[0]}:${timesSec[timesSec.length - 1]}`;
    if (sig !== this._sig) {
      const timesMs = timesSec.map((t) => t * 1000);
      this._runs = buildSessionRuns(timesMs, config);
      this._boundaries = config.separatorColor ? detectDayBoundaries(timesMs, config) : [];
      this._sig = sig;
    }

    const timeScale = chart.timeScale();
    const halfBar = timeScale.options().barSpacing / 2;
    const coordAt = (idx: number): number | null => {
      const c = timeScale.timeToCoordinate(timesSec[idx] as Time);
      return c === null ? null : (c as number);
    };

    const rects: SessionRectPx[] = [];
    for (const run of this._runs) {
      if (run.sessionIndex < 0) continue;
      const color = config.sessions[run.sessionIndex]?.color;
      if (!color || color === 'transparent') continue;
      const xs = coordAt(run.startIdx);
      const xe = coordAt(run.endIdx);
      if (xs === null || xe === null) continue;
      rects.push({ left: xs - halfBar, right: xe + halfBar, color });
    }

    const separatorsX: number[] = [];
    for (const idx of this._boundaries) {
      const x = coordAt(idx);
      if (x === null) continue;
      separatorsX.push(x - halfBar); // sits at the left edge of the new day's first bar
    }

    this._data = {
      rects,
      separatorsX,
      separatorColor: config.separatorColor ?? '',
      separatorWidthPx: config.separatorWidthPx ?? 1,
    };
  }

  renderer() {
    return new SessionsRenderer(this._data);
  }
}

class SessionsRenderer {
  private _data: SessionsViewData | null;

  constructor(data: SessionsViewData | null) {
    this._data = data;
  }

  // Session shading — behind the candles. Drawn in media space (after scaling by the
  // pixel ratios), so the full pane height is `scope.mediaSize.height`.
  drawBackground(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
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
  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
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
  /** Bumped on every applyOptions so the pane view invalidates its classification cache. */
  _configVersion = 0;
  private _requestUpdate: (() => void) | null = null;
  private _paneViews: SessionsPaneView[];

  constructor(config: SessionsConfig) {
    this._config = config;
    this._paneViews = [new SessionsPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<'Candlestick'>;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  /** Update the live config (timezone / sessions / separators) and schedule a redraw. */
  applyOptions(config: SessionsConfig): void {
    this._config = config;
    this._configVersion += 1; // invalidates the pane view's classification cache
    this._requestUpdate?.();
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._paneViews.forEach((pw) => pw.update());
  }
}
