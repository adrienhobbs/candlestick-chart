import {
  IPrimitivePaneRenderer,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import type { ChartMarker, ChartRailMarker, ChartSignpost, OHLCVBar } from '../../types/chart';
import { fadeHex, snapDown } from '../../components/trade-markers';
import { layoutPillTops, spreadSameBar, type KeepOut } from '../../components/annotations-layout';

// What lightweight-charts' series markers can't draw, as one custom primitive on the
// candlestick series:
//   - price marks: ▶ / ◀ (entry / exit fills) and hollow (outline) shapes;
//   - signposts: a faint vertical line + a label pill on the pane's top edge;
//   - the event rail: a strip along the bottom of the price pane holding small marks.
// Inputs are snapped to bar times once (on setData); pixel positions are recomputed
// every frame from the time/price scales (cheap).

export interface AnnotationsData {
  markers: ChartMarker[];
  signposts: ChartSignpost[];
  rail: ChartRailMarker[];
}

/** Rail strip height and its gap above the pane's bottom edge, media px. */
export const RAIL_HEIGHT_PX = 16;
export const RAIL_BOTTOM_GAP_PX = 2;
const PILL_HEIGHT_PX = 16;
const PILL_ROW_GAP_PX = 3;
const PILL_TOP_PX = 4;
const PILL_INSET_PX = 2;
const PILL_FONT = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
const RAIL_FONT = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
/** Base marker half-size in px at `size: 1` (lightweight-charts' default marker is ~similar). */
const BASE_HALF = 6;

interface SnappedMarker {
  m: ChartMarker;
  barSec: number;
}
interface SnappedSignpost {
  s: ChartSignpost;
  barSec: number;
}
interface SnappedRail {
  r: ChartRailMarker;
  barSec: number;
  offset: number;
}

interface FrameMark {
  x: number;
  y: number;
  half: number;
  shape: NonNullable<ChartMarker['shape']>;
  color: string;
  hollow: boolean;
}
interface FramePill {
  x: number;
  /** Top edge, media px. */
  top: number;
  width: number;
  label: string;
  color: string;
}
interface FrameRail {
  x: number;
  shape: NonNullable<ChartRailMarker['shape']>;
  color: string;
  hollow: boolean;
  label: string | null;
}
interface Frame {
  marks: FrameMark[];
  pills: FramePill[];
  railMarks: FrameRail[];
  hasRail: boolean;
  bodyHalf: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  if (!measureCtx) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      measureCtx = null;
    }
  }
  if (!measureCtx) return text.length * 6.5;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/** Dark or light ink for text on a solid `color` pill. */
function inkFor(color: string): string {
  const m = /^#([0-9a-f]{6})/i.exec(color.trim());
  if (!m) return '#0b0f14';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? '#0b0f14' : '#f8fafc';
}

class AnnotationsPaneView {
  constructor(private readonly source: AnnotationsPrimitive) {}
  private frame: Frame | null = null;

  zOrder(): 'top' {
    return 'top';
  }

  update() {
    const { _chart: chart, _series: series } = this.source;
    if (!chart || !series) {
      this.frame = null;
      return;
    }
    const ts = chart.timeScale();
    const spacing = ts.options().barSpacing;
    const bodyHalf = Math.max(1.5, spacing * 0.4);
    const xAt = (sec: number): number | null => {
      const c = ts.timeToCoordinate(sec as Time);
      return c === null ? null : (c as number);
    };
    const barBySec = this.source._barBySec;

    const marks: FrameMark[] = [];
    for (const { m, barSec } of this.source._markers) {
      const x = xAt(barSec);
      if (x === null) continue;
      const half = BASE_HALF * (m.size ?? 1);
      let y: number | null = null;
      const pos = m.position ?? (m.price != null ? 'atPriceMiddle' : 'aboveBar');
      if (m.price != null && pos.startsWith('atPrice')) {
        const c = series.priceToCoordinate(m.price);
        y = c === null ? null : (c as number);
      } else {
        const bar = barBySec.get(barSec);
        const ref = pos === 'belowBar' ? bar?.low : bar?.high;
        const c = ref == null ? null : series.priceToCoordinate(ref);
        if (c !== null && c !== undefined) y = (c as number) + (pos === 'belowBar' ? half + 4 : -(half + 4));
      }
      if (y === null) continue;
      marks.push({ x, y, half, shape: m.shape ?? 'circle', color: m.color, hollow: m.hollow === true });
    }

    const pillInputs: { x: number; width: number; label: string; color: string }[] = [];
    for (const { s, barSec } of this.source._signposts) {
      const x = xAt(barSec);
      if (x === null) continue;
      pillInputs.push({ x, width: textWidth(s.label, PILL_FONT) + 12, label: s.label, color: s.color });
    }
    const tops = layoutPillTops(pillInputs, this.source._keepOut, {
      top: PILL_TOP_PX,
      height: PILL_HEIGHT_PX,
      rowGap: PILL_ROW_GAP_PX,
      inset: PILL_INSET_PX,
    });
    const pills = pillInputs.map((p, i) => ({ ...p, top: tops[i] }));

    const railMarks: FrameRail[] = [];
    const railX: number[] = [];
    for (const { r, barSec, offset } of this.source._rail) {
      const x = xAt(barSec);
      if (x === null) continue;
      railX.push(x + offset);
      railMarks.push({ x: x + offset, shape: r.shape ?? 'circle', color: r.color, hollow: r.hollow === true, label: r.label ?? null });
    }
    // Drop a label when the next mark is too close to fit it.
    const order = railMarks.map((_, i) => i).sort((a, b) => railMarks[a].x - railMarks[b].x);
    order.forEach((idx, k) => {
      const mark = railMarks[idx];
      if (!mark.label) return;
      const next = order[k + 1];
      const room = next === undefined ? Infinity : railMarks[next].x - mark.x;
      if (room < textWidth(mark.label, RAIL_FONT) + 14) mark.label = null;
    });

    this.frame = { marks, pills, railMarks, hasRail: this.source._rail.length > 0, bodyHalf };
  }

  renderer() {
    return new AnnotationsRenderer(this.frame, this.source._railBackground);
  }
}

function pathShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  half: number,
  bodyHalf: number,
) {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(x - half * 0.8, y - half * 0.8, half * 1.6, half * 1.6);
      break;
    case 'arrowRight': {
      // ▶ left of the bar, its tip just short of the candle body, pointing at the price.
      const tip = x - bodyHalf - 1;
      ctx.moveTo(tip, y);
      ctx.lineTo(tip - half * 1.6, y - half);
      ctx.lineTo(tip - half * 1.6, y + half);
      ctx.closePath();
      break;
    }
    case 'arrowLeft': {
      const tip = x + bodyHalf + 1;
      ctx.moveTo(tip, y);
      ctx.lineTo(tip + half * 1.6, y - half);
      ctx.lineTo(tip + half * 1.6, y + half);
      ctx.closePath();
      break;
    }
    case 'arrowUp':
    case 'triangleUp':
      ctx.moveTo(x, y - half);
      ctx.lineTo(x + half, y + half * 0.8);
      ctx.lineTo(x - half, y + half * 0.8);
      ctx.closePath();
      break;
    case 'arrowDown':
    case 'triangleDown':
      ctx.moveTo(x, y + half);
      ctx.lineTo(x + half, y - half * 0.8);
      ctx.lineTo(x - half, y - half * 0.8);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - half);
      ctx.lineTo(x + half, y);
      ctx.lineTo(x, y + half);
      ctx.lineTo(x - half, y);
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, half * 0.8, 0, Math.PI * 2);
  }
}

function paint(ctx: CanvasRenderingContext2D, color: string, hollow: boolean) {
  if (hollow) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

class AnnotationsRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly frame: Frame | null,
    private readonly railBackground: string,
  ) {}

  draw(target: RenderTarget) {
    target.useMediaCoordinateSpace((scope) => {
      const f = this.frame;
      if (!f) return;
      const ctx = scope.context;
      const w = scope.mediaSize.width;
      const h = scope.mediaSize.height;
      ctx.save();

      // Signpost lines first (behind the pills and marks).
      for (const p of f.pills) {
        ctx.strokeStyle = fadeHex(p.color, 0.45) ?? p.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const x = Math.round(p.x) + 0.5;
        ctx.moveTo(x, p.top + PILL_HEIGHT_PX);
        ctx.lineTo(x, f.hasRail ? h - RAIL_HEIGHT_PX - RAIL_BOTTOM_GAP_PX : h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (const mk of f.marks) {
        pathShape(ctx, mk.shape, mk.x, mk.y, mk.half, f.bodyHalf);
        paint(ctx, mk.color, mk.hollow);
      }

      // Pills on the top edge, clamped inside the pane.
      ctx.font = PILL_FONT;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (const p of f.pills) {
        const left = Math.min(Math.max(p.x - p.width / 2, PILL_INSET_PX), w - p.width - PILL_INSET_PX);
        const top = p.top;
        const r = PILL_HEIGHT_PX / 2;
        ctx.beginPath();
        ctx.moveTo(left + r, top);
        ctx.arcTo(left + p.width, top, left + p.width, top + PILL_HEIGHT_PX, r);
        ctx.arcTo(left + p.width, top + PILL_HEIGHT_PX, left, top + PILL_HEIGHT_PX, r);
        ctx.arcTo(left, top + PILL_HEIGHT_PX, left, top, r);
        ctx.arcTo(left, top, left + p.width, top, r);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillStyle = inkFor(p.color);
        ctx.fillText(p.label, left + p.width / 2, top + PILL_HEIGHT_PX / 2 + 0.5);
      }

      if (f.hasRail) {
        const top = h - RAIL_HEIGHT_PX - RAIL_BOTTOM_GAP_PX;
        ctx.fillStyle = this.railBackground;
        ctx.fillRect(0, top, w, RAIL_HEIGHT_PX);
        const cy = top + RAIL_HEIGHT_PX / 2;
        ctx.font = RAIL_FONT;
        ctx.textAlign = 'left';
        for (const rm of f.railMarks) {
          pathShape(ctx, rm.shape, rm.x, cy, 4, 0);
          paint(ctx, rm.color, rm.hollow);
          if (rm.label) {
            ctx.fillStyle = rm.color;
            ctx.fillText(rm.label, rm.x + 6, cy + 0.5);
          }
        }
      }
      ctx.restore();
    });
  }
}

export class AnnotationsPrimitive implements ISeriesPrimitive<Time> {
  _chart: IChartApi | null = null;
  _series: ISeriesApi<'Candlestick'> | null = null;
  _markers: SnappedMarker[] = [];
  _signposts: SnappedSignpost[] = [];
  _rail: SnappedRail[] = [];
  _railBackground = 'rgba(148, 163, 184, 0.08)';
  /** Top-left box the signpost pills stay out of (the OHLC legend), or null. */
  _keepOut: KeepOut | null = null;
  private _requestUpdate: (() => void) | null = null;
  private readonly _paneViews = [new AnnotationsPaneView(this)];
  /** Bar high/low by time (seconds), for marks placed above/below a bar. */
  _barBySec = new Map<number, { high: number; low: number }>();

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

  /** Snap every input to a bar (`barTimesMs` ascending, unique) and schedule a redraw. */
  setData(data: AnnotationsData, bars: OHLCVBar[], barTimesMs: number[], railBackground?: string): void {
    this._barBySec = new Map(bars.map((b) => [b.timestamp / 1000, { high: b.high, low: b.low }]));
    const snap = (ms: number): number | null => {
      if (!Number.isFinite(ms)) return null;
      const at = snapDown(barTimesMs, ms);
      return at === null ? null : at / 1000;
    };
    this._markers = [];
    for (const m of data.markers) {
      const barSec = snap(m.time);
      if (barSec !== null) this._markers.push({ m, barSec });
    }
    this._signposts = [];
    for (const s of data.signposts) {
      const barSec = snap(s.time);
      if (barSec !== null) this._signposts.push({ s, barSec });
    }
    const rail: { r: ChartRailMarker; barSec: number }[] = [];
    for (const r of data.rail) {
      const barSec = snap(r.time);
      if (barSec !== null) rail.push({ r, barSec });
    }
    const offsets = spreadSameBar(rail.map((x) => x.barSec), 10);
    this._rail = rail.map((x, i) => ({ ...x, offset: offsets[i] }));
    if (railBackground) this._railBackground = railBackground;
    this._requestUpdate?.();
  }

  setKeepOut(keepOut: KeepOut | null): void {
    this._keepOut = keepOut;
    this._requestUpdate?.();
  }

  paneViews() {
    return this._paneViews;
  }

  updateAllViews(): void {
    this._paneViews.forEach((pv) => pv.update());
  }
}
