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
