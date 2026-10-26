/**
 * Decides when the chart asks the host for older bars (`onLoadMoreData`).
 *
 * - A request fires when the visible range reaches the left edge, once per arrival:
 *   it re-arms after the view leaves the edge or older bars arrive. Without that, a
 *   load that found no older history would be re-requested on every scroll event.
 * - A request ends when bars older than the requested oldest arrive, or when the
 *   host signals it is done (its promise settled, or the fallback timeout). Growth
 *   is judged by the oldest timestamp, not the bar count, so a live bar appended on
 *   the right does not end a load early.
 */
export interface LoadMoreGate {
  /** Visible range moved. Returns the oldest timestamp to request, or null. */
  onRange(from: number, oldestTimestamp: number | undefined): number | null;
  /** Bars changed. Returns true when this ended a pending request. */
  onBars(oldestTimestamp: number | undefined): boolean;
  /** The host finished (or gave up on) the request. Returns true if one was pending. */
  onSettled(): boolean;
  readonly loading: boolean;
}

/** Logical bar index under which the view counts as being at the left edge. */
export const LOAD_MORE_EDGE_BARS = 5;

export function createLoadMoreGate(): LoadMoreGate {
  let loading = false;
  let armed = true;
  let requestedOldest: number | null = null;
  let lastOldest: number | undefined;

  return {
    get loading() {
      return loading;
    },
    onRange(from, oldestTimestamp) {
      if (from >= LOAD_MORE_EDGE_BARS) {
        armed = true;
        return null;
      }
      if (loading || !armed || oldestTimestamp == null) return null;
      loading = true;
      armed = false;
      requestedOldest = oldestTimestamp;
      return oldestTimestamp;
    },
    onBars(oldestTimestamp) {
      const changed = oldestTimestamp !== lastOldest;
      lastOldest = oldestTimestamp;
      if (loading) {
        if (oldestTimestamp != null && requestedOldest != null && oldestTimestamp < requestedOldest) {
          loading = false;
          armed = true;
          requestedOldest = null;
          return true;
        }
        return false;
      }
      // Older bars that land after the request settled, or a host that replaced its
      // data (new symbol), make the left edge worth asking about again.
      if (changed) armed = true;
      return false;
    },
    onSettled() {
      if (!loading) return false;
      loading = false;
      requestedOldest = null;
      return true;
    },
  };
}
