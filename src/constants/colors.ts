/**
 * Shared color constants.
 *
 * These are the *shared* literals reused across the chart and indicator code.
 * Per-indicator distinct line colors intentionally remain inline in each
 * indicator definition — they are deliberate choices, not duplication.
 */

/** Stable palette for multi-output indicators whose fields lack an explicit
 *  color setting. Slots are assigned round-robin by output-field index. */
export const PALETTE: string[] = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#a855f7',
  '#06b6d4',
];

/** Default fill for band/channel/cloud shaded areas. */
export const BAND_FILL = 'rgba(59, 130, 246, 0.1)';

/** Default trade-marker colors (match the library's default candle palette). */
export const WIN_COLOR = '#10b981';
export const LOSS_COLOR = '#ef4444';
