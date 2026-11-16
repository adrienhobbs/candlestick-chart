import type { LiveConnection, LiveStreamState } from './types';

export function deriveStreamState(args: {
  connection: LiveConnection;
  tickSinceOpen: boolean;
  /** Wall-clock time the last tick arrived. */
  lastTickAt: number | null;
  now: number;
  stallAfterMs: number;
}): LiveStreamState {
  if (args.connection === 'closed') return 'disconnected';
  if (args.connection === 'connecting' || !args.tickSinceOpen || args.lastTickAt === null) return 'connecting';
  return args.now - args.lastTickAt >= args.stallAfterMs ? 'stalled' : 'live';
}
