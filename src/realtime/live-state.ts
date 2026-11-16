import type { LiveConnection, LiveStreamState } from './types';

/** Tick silence after which an open stream counts as stalled. */
export const DEFAULT_STALL_AFTER_MS = 30_000;

export function deriveStreamState(args: {
  connection: LiveConnection;
  tickSinceOpen: boolean;
  /** Wall-clock time the last tick arrived. */
  lastTickAt: number | null;
  now: number;
  /** Non-finite or non-positive values fall back to DEFAULT_STALL_AFTER_MS. */
  stallAfterMs: number;
}): LiveStreamState {
  if (args.connection === 'closed') return 'disconnected';
  if (args.connection === 'connecting' || !args.tickSinceOpen || args.lastTickAt === null) return 'connecting';
  const stallAfterMs =
    Number.isFinite(args.stallAfterMs) && args.stallAfterMs > 0 ? args.stallAfterMs : DEFAULT_STALL_AFTER_MS;
  return args.now - args.lastTickAt >= stallAfterMs ? 'stalled' : 'live';
}
