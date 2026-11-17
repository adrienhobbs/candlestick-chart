import type { ChartTheme } from '../types/chart';
import type { LiveState } from '../realtime/types';

export function livePriceColor(live: LiveState, theme: ChartTheme): string {
  return live.price >= live.reference
    ? (theme.livePriceUpColor ?? theme.upColor)
    : (theme.livePriceDownColor ?? theme.downColor);
}

/** m:ss, floored; a skewed clock or an overdue bar shows 0:00. */
export function formatCountdown(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function countdownText(live: LiveState | null, nowMs: number): string | null {
  if (live === null || live.barCloseAt === null) return null;
  return formatCountdown(live.barCloseAt - nowMs);
}

/** Height of the countdown box, px (its line-height). */
export const COUNTDOWN_HEIGHT_PX = 16;
/** lightweight-charts' default `layout.fontSize`. */
const DEFAULT_AXIS_FONT_SIZE = 12;

/** Half the price axis tag's height for the chart's axis font size. */
export function tagHalfHeight(fontSize: number | undefined): number {
  const size = typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize > 0 ? fontSize : DEFAULT_AXIS_FONT_SIZE;
  return Math.ceil(size * 0.75);
}

function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c);
  if (hex) {
    const h = hex[1];
    const digits = h.length <= 4 ? [...h.slice(0, 3)].map((d) => d + d) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
    return digits.map((d) => parseInt(d, 16)) as [number, number, number];
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return null;
}

/** Black or white, whichever reads better on `background` (WCAG relative luminance). White if unparseable. */
export function contrastTextColor(background: string): '#000' | '#fff' {
  const rgb = parseRgb(background);
  if (rgb === null) return '#fff';
  const [r, g, b] = rgb.map((v) => {
    const s = Math.min(255, Math.max(0, v)) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Above this, black text has the higher contrast ratio.
  return luminance > 0.179 ? '#000' : '#fff';
}
