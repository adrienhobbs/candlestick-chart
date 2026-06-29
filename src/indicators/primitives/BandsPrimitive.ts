import {
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  type LineData,
} from 'lightweight-charts';

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

class AreaBetweenLinesPaneView {
  private _source: BandsPrimitive;
  private _data: BandData | null = null;

  constructor(source: BandsPrimitive) {
    this._source = source;
  }

  update() {
    const series1 = this._source._upperSeries;
    const series2 = this._source._lowerSeries;
    const chart = this._source._chart;

    if (!series1 || !series2 || !chart) return;

    const timeScale = chart.timeScale();

    const data1 = series1.data() as readonly LineData<Time>[];
    const data2 = series2.data() as readonly LineData<Time>[];

    const points: BandPoint[] = [];

    let i = 0;
    let j = 0;

    while (i < data1.length && j < data2.length) {
      const d1 = data1[i];
      const d2 = data2[j];

      // Bands are over UTCTimestamp line series; compare the ordinal/epoch number.
      const t1 = d1.time as number;
      const t2 = d2.time as number;

      if (t1 < t2) {
        i++;
      } else if (t1 > t2) {
        j++;
      } else {
        const x = timeScale.timeToCoordinate(d1.time);
        const y1 = series1.priceToCoordinate(d1.value);
        const y2 = series2.priceToCoordinate(d2.value);

        if (x !== null && y1 !== null && y2 !== null) {
          points.push({ x, y1, y2 });
        }
        i++;
        j++;
      }
    }

    this._data = {
      points,
      color: this._source._options.fillColor || 'rgba(59, 130, 246, 0.1)',
    };
  }

  renderer() {
    return new AreaBetweenLinesRenderer(this._data);
  }
}

class AreaBetweenLinesRenderer {
  private _data: BandData | null;

  constructor(data: BandData | null) {
    this._data = data;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
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

  drawBackground(target: any) {
    this.draw(target);
  }
}

export class BandsPrimitive implements ISeriesPrimitive<Time> {
  _options: BandsPrimitiveOptions;
  _upperSeries: ISeriesApi<'Line'>;
  _lowerSeries: ISeriesApi<'Line'>;
  _chart: IChartApi | null = null;
  _series: ISeriesApi<'Line'> | null = null;
  private _paneViews: AreaBetweenLinesPaneView[];

  constructor(options: BandsPrimitiveOptions) {
    this._options = options;
    this._upperSeries = options.upperSeries;
    this._lowerSeries = options.lowerSeries;
    this._paneViews = [new AreaBetweenLinesPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<'Line'>;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._paneViews.forEach((pw) => pw.update());
  }
}
