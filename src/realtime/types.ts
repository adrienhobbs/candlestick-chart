/** One price from the host's stream. `time` is epoch ms or an ISO string. */
export interface RealtimeTick {
  price: number;
  time: number | string;
  /**
   * Traded size. A bucket's sizes are summed, and its bar shows the larger of that sum
   * and REST's volume (REST may already include the streamed trades).
   */
  size?: number;
  /** The series (symbol) this tick is for. When set, a tick for another series is dropped. */
  key?: string;
}

/** A bucket's live open/high/low/close/volume as the stream saw it. */
export interface LiveBucketBar {
  bucket: number;
  open: number;
  /** Includes `open`, so a bar appended from this bucket is a valid candle. */
  high: number;
  /** Includes `open`, so a bar appended from this bucket is a valid candle. */
  low: number;
  close: number;
  /** Shown volume: the larger of REST's volume for the bucket and `tickVolume`. */
  volume: number;
  /** Sum of the sizes of the ticks folded into this bucket. */
  tickVolume: number;
  /** Highest traded price: the ticks', plus REST's high when REST had the bucket first. */
  tickHigh: number;
  /** Lowest traded price: the ticks', plus REST's low when REST had the bucket first. */
  tickLow: number;
}

/** The forming bucket plus the closed buckets REST has not covered yet, oldest first. */
export interface LiveFoldState extends LiveBucketBar {
  key: string;
  timeframe: string;
  /** Time of the newest folded tick; an older tick is ignored. */
  lastTickMs: number;
  closed: LiveBucketBar[];
}

/** What the host knows about its socket. */
export type LiveConnection = 'connecting' | 'open' | 'closed';

/** What the chart shows about the stream. */
export type LiveStreamState = 'connecting' | 'live' | 'stalled' | 'disconnected';

export interface LiveState {
  price: number;
  /** Up/down color reference: the host's (e.g. previous close) or the forming bar's open. */
  reference: number;
  /** End of the forming intraday bucket (epoch ms); null on 1Day. */
  barCloseAt: number | null;
  state: LiveStreamState;
}

/**
 * A span of bars to backfill. For intraday timeframes `fromMs` and `toMs` are bucket
 * starts the hook already has, both inclusive; bars returned at either end are
 * harmless because withGapBars keeps only bars newer than the host's. For other
 * timeframes (e.g. a 1Day reconnect) `toMs` may be the raw instant.
 */
export interface GapRange {
  fromMs: number;
  toMs: number;
}
