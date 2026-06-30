import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { clampOverlayX } from './overlay-geometry';

// Time-bounded trade overlays drawn as a custom ISeriesPrimitive: horizontal line
// SEGMENTS (entry/stop/target) that span only [startSec, endSec] at their price, and
// translucent BOXES (e.g. an MFE↔MAE band) spanning [startSec,endSec] × [top,bottom].
// Both auto-hide when their time window scrolls out of view — unlike infinite price
// lines / full-width bands. Mirrors SessionsPrimitive's coordinate-space handling.

/** Normalized segment (times already in SECONDS, defaults resolved by the hook). */
export interface TradeOverlaySegment {
  id: string;
  price: number;
  startSec: number;
  endSec: number;
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  title?: string;
}

/** Normalized box (translucent fill across a price range and time window). */
export interface TradeOverlayBox {
  id: string;
  top: number;
  bottom: number;
  startSec: number;
  endSec: number;
  color: string;
  borderColor?: string;
  topLabel?: string;
  bottomLabel?: string;
}

export interface TradeOverlaysConfig {
  segments: TradeOverlaySegment[];
  boxes: TradeOverlayBox[];
}

interface SegmentPx { x1: number; x2: number; y: number; color: string; lineWidth: number; lineStyle: string; title?: string }
interface BoxPx { x1: number; x2: number; yTop: number; yBot: number; color: string; borderColor?: string; topLabel?: string; bottomLabel?: string }

interface TradeOverlaysViewData {
  segments: SegmentPx[];
  boxes: BoxPx[];
}

class TradeOverlaysPaneView {
  private _source: TradeOverlaysPrimitive;
  private _data: TradeOverlaysViewData | null = null;

  constructor(source: TradeOverlaysPrimitive) {
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

    const timeScale = chart.timeScale();
    const visible = timeScale.getVisibleRange();
    if (!visible) {
      this._data = null;
      return;
    }
    const vFrom = visible.from as number;
    const vTo = visible.to as number;
    const width = timeScale.width();
    const project = (timeSec: number): number | null => {
      const c = timeScale.timeToCoordinate(timeSec as Time);
      return c === null ? null : (c as number);
    };

    const segments: SegmentPx[] = [];
    for (const s of config.segments) {
      const xs = clampOverlayX(s.startSec, s.endSec, vFrom, vTo, width, project);
      if (!xs) continue;
      const y = series.priceToCoordinate(s.price);
      if (y === null) continue;
      segments.push({ x1: xs[0], x2: xs[1], y: y as number, color: s.color, lineWidth: s.lineWidth, lineStyle: s.lineStyle, title: s.title });
    }

    const boxes: BoxPx[] = [];
    for (const b of config.boxes) {
      const xs = clampOverlayX(b.startSec, b.endSec, vFrom, vTo, width, project);
      if (!xs) continue;
      const yT = series.priceToCoordinate(b.top);
      const yB = series.priceToCoordinate(b.bottom);
      if (yT === null || yB === null) continue;
      boxes.push({
        x1: xs[0], x2: xs[1],
        yTop: Math.min(yT as number, yB as number),
        yBot: Math.max(yT as number, yB as number),
        color: b.color, borderColor: b.borderColor,
        topLabel: b.topLabel, bottomLabel: b.bottomLabel,
      });
    }

    this._data = { segments, boxes };
  }

  renderer() {
    return new TradeOverlaysRenderer(this._data);
  }
}

const DASH = { dashed: [6, 4], dotted: [2, 3] } as const;

class TradeOverlaysRenderer {
  private _data: TradeOverlaysViewData | null;

  constructor(data: TradeOverlaysViewData | null) {
    this._data = data;
  }

  // Box fills — behind the candles. Drawn in media space (scaled by the pixel
  // ratios), matching SessionsPrimitive's shading layer.
  drawBackground(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const data = this._data;
      if (!data || data.boxes.length === 0) return;
      const ctx = scope.context;
      ctx.save();
      ctx.scale(scope.horizontalPixelRatio, scope.verticalPixelRatio);
      for (const b of data.boxes) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x1, b.yTop, b.x2 - b.x1, b.yBot - b.yTop);
      }
      ctx.restore();
    });
  }

  // Segment lines (+ optional box border + inline title) — in front. Drawn in
  // bitmap space for crisp 1px lines (x/y multiplied by the pixel ratios).
  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const data = this._data;
      if (!data) return;
      const ctx = scope.context;
      const hpr = scope.horizontalPixelRatio;
      const vpr = scope.verticalPixelRatio;

      // Optional thin box borders + inline top/bottom labels.
      for (const b of data.boxes) {
        if (b.borderColor) {
          ctx.save();
          ctx.strokeStyle = b.borderColor;
          ctx.lineWidth = Math.max(1, Math.round(hpr));
          ctx.strokeRect(
            Math.round(b.x1 * hpr), Math.round(b.yTop * vpr),
            Math.round((b.x2 - b.x1) * hpr), Math.round((b.yBot - b.yTop) * vpr),
          );
          ctx.restore();
        }
        if (b.topLabel || b.bottomLabel) {
          ctx.save();
          ctx.fillStyle = b.borderColor ?? '#cbd5e1';
          ctx.font = `${Math.round(10 * vpr)}px sans-serif`;
          const xText = Math.round(b.x1 * hpr) + Math.round(4 * hpr);
          if (b.topLabel) {
            ctx.textBaseline = 'top';
            ctx.fillText(b.topLabel, xText, Math.round(b.yTop * vpr) + Math.round(2 * vpr));
          }
          if (b.bottomLabel) {
            ctx.textBaseline = 'bottom';
            ctx.fillText(b.bottomLabel, xText, Math.round(b.yBot * vpr) - Math.round(2 * vpr));
          }
          ctx.restore();
        }
      }

      for (const s of data.segments) {
        const x1 = Math.round(s.x1 * hpr);
        const x2 = Math.round(s.x2 * hpr);
        const yb = Math.round(s.y * vpr);
        const thickness = Math.max(1, Math.round(s.lineWidth * vpr));
        ctx.save();
        if (s.lineStyle === 'solid') {
          // fillRect avoids the half-pixel stroke offset → crisp.
          ctx.fillStyle = s.color;
          ctx.fillRect(x1, yb - Math.floor(thickness / 2), x2 - x1, thickness);
        } else {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = thickness;
          const pat = DASH[s.lineStyle as 'dashed' | 'dotted'] ?? [];
          ctx.setLineDash(pat.map((d) => d * hpr));
          ctx.beginPath();
          ctx.moveTo(x1, yb);
          ctx.lineTo(x2, yb);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Inline title at the left end, just above the line.
        if (s.title) {
          ctx.fillStyle = s.color;
          ctx.font = `${Math.round(10 * vpr)}px sans-serif`;
          ctx.textBaseline = 'bottom';
          ctx.fillText(s.title, x1 + Math.round(3 * hpr), yb - Math.round(2 * vpr));
        }
        ctx.restore();
      }
    });
  }
}

export class TradeOverlaysPrimitive implements ISeriesPrimitive<Time> {
  _chart: IChartApi | null = null;
  _series: ISeriesApi<'Candlestick'> | null = null;
  _config: TradeOverlaysConfig;
  private _requestUpdate: (() => void) | null = null;
  private _paneViews: TradeOverlaysPaneView[];

  constructor(config: TradeOverlaysConfig) {
    this._config = config;
    this._paneViews = [new TradeOverlaysPaneView(this)];
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

  /** Replace the overlay set and schedule a redraw (idle data changes repaint). */
  applyOptions(config: TradeOverlaysConfig): void {
    this._config = config;
    this._requestUpdate?.();
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._paneViews.forEach((pw) => pw.update());
  }

  // Intentionally NO autoscaleInfo() — overlays must not distort the candle price scale.
}
