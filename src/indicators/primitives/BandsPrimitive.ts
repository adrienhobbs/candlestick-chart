import {
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  type LineData,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { BAND_FILL } from '../../constants/colors';

export interface BandsPrimitiveOptions {
  upperSeries: ISeriesApi<'Line'>;
  lowerSeries: ISeriesApi<'Line'>;
  fillColor: string;
}

interface BandPoint {
  x: number;
  y1: number;
  y2: number;
}

interface BandData {
  points: BandPoint[];
  color: string;
}

/** A time both bands have a value at. */
interface BandPair {
  time: number;
  upper: number;
  lower: number;
}

/** The times both bands share, in order; a time either band lacks is skipped. */
function pairBands(data1: readonly LineData<Time>[], data2: readonly LineData<Time>[]): BandPair[] {
  const pairs: BandPair[] = [];
  let i = 0;
  let j = 0;
  while (i < data1.length && j < data2.length) {
    // Bands are over UTCTimestamp line series; compare the ordinal/epoch number.
    const t1 = data1[i].time as number;
    const t2 = data2[j].time as number;
    if (t1 < t2) i++;
    else if (t1 > t2) j++;
    else {
      pairs.push({ time: t1, upper: data1[i].value, lower: data2[j].value });
      i++;
      j++;
    }
  }
  return pairs;
}

/** First index whose time is at least `time`. */
function lowerBound(pairs: readonly BandPair[], time: number): number {
  let lo = 0;
  let hi = pairs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pairs[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

class AreaBetweenLinesPaneView {
  private _source: BandsPrimitive;

  constructor(source: BandsPrimitive) {
    this._source = source;
  }

  renderer() {
    return new AreaBetweenLinesRenderer(this._source._bandData());
  }
}

class AreaBetweenLinesRenderer {
  private _data: BandData | null;

  constructor(data: BandData | null) {
    this._data = data;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      if (!this._data || this._data.points.length === 0) return;

      const ctx = scope.context;
      ctx.save();
      ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);

      const points = this._data.points;

      ctx.beginPath();

      ctx.moveTo(points[0].x, points[0].y1);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y1);
      }

      for (let i = points.length - 1; i >= 0; i--) {
        ctx.lineTo(points[i].x, points[i].y2);
      }

      ctx.closePath();

      ctx.fillStyle = this._data.color;
      ctx.fill();

      ctx.restore();
    });
  }

  drawBackground(target: CanvasRenderingTarget2D) {
    this.draw(target);
  }
}

/**
 * Fills between two line series. lightweight-charts calls `updateAllViews` on every
 * data change, so it and the data-changed handler only mark state stale; the band
 * data is re-read at most once per draw after a change, and only the points from
 * the last one left of the pane to the first one right of it are converted. The
 * fill inside the pane is the same as filling the whole series.
 */
export class BandsPrimitive implements ISeriesPrimitive<Time> {
  _options: BandsPrimitiveOptions;
  _upperSeries: ISeriesApi<'Line'>;
  _lowerSeries: ISeriesApi<'Line'>;
  _chart: IChartApi | null = null;
  _series: ISeriesApi<'Line'> | null = null;
  private _paneViews: AreaBetweenLinesPaneView[];
  /** Null when the band data changed since it was last read. */
  private _pairs: BandPair[] | null = null;
  private _bands: BandData | null = null;
  private _viewStale = true;
  private readonly _onDataChanged = () => {
    this._pairs = null;
    this._viewStale = true;
  };

  constructor(options: BandsPrimitiveOptions) {
    this._options = options;
    this._upperSeries = options.upperSeries;
    this._lowerSeries = options.lowerSeries;
    this._paneViews = [new AreaBetweenLinesPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<'Line'>;
    this._upperSeries.subscribeDataChanged(this._onDataChanged);
    this._lowerSeries.subscribeDataChanged(this._onDataChanged);
    this._onDataChanged();
  }

  detached(): void {
    this._upperSeries.unsubscribeDataChanged(this._onDataChanged);
    this._lowerSeries.unsubscribeDataChanged(this._onDataChanged);
    this._chart = null;
    this._series = null;
    this._pairs = null;
    this._bands = null;
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._viewStale = true;
  }

  /** The fill polygon for the current view; recomputed only after a view update or data change. */
  _bandData(): BandData | null {
    if (!this._viewStale) return this._bands;
    this._viewStale = false;
    this._bands = this._computeBands();
    return this._bands;
  }

  private _computeBands(): BandData | null {
    const chart = this._chart;
    if (!chart) return null;
    if (this._pairs === null) {
      this._pairs = pairBands(
        this._upperSeries.data() as readonly LineData<Time>[],
        this._lowerSeries.data() as readonly LineData<Time>[],
      );
    }
    const pairs = this._pairs;
    const color = this._options.fillColor || BAND_FILL;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleRange();
    if (range === null || pairs.length === 0) return { points: [], color };

    const toPoint = (p: BandPair): BandPoint | null => {
      const x = timeScale.timeToCoordinate(p.time as Time);
      const y1 = this._upperSeries.priceToCoordinate(p.upper);
      const y2 = this._lowerSeries.priceToCoordinate(p.lower);
      return x !== null && y1 !== null && y2 !== null ? { x, y1, y2 } : null;
    };

    const first = lowerBound(pairs, range.from as number);
    const end = lowerBound(pairs, (range.to as number) + 1e-9);
    const points: BandPoint[] = [];
    // Walk out past each edge until a point lies outside the pane, so the polygon's
    // closing edges stay off-screen as they would with every point drawn. A point
    // with no coordinate ends the walk, so it can never scan the whole history.
    const before: BandPoint[] = [];
    for (let i = first - 1; i >= 0; i--) {
      const pt = toPoint(pairs[i]);
      if (pt === null) break;
      before.push(pt);
      if (pt.x <= 0) break;
    }
    for (let i = before.length - 1; i >= 0; i--) points.push(before[i]);
    for (let i = first; i < end; i++) {
      const pt = toPoint(pairs[i]);
      if (pt !== null) points.push(pt);
    }
    const width = timeScale.width();
    for (let i = end; i < pairs.length; i++) {
      const pt = toPoint(pairs[i]);
      if (pt === null) break;
      points.push(pt);
      if (pt.x >= width) break;
    }
    return { points, color };
  }
}
