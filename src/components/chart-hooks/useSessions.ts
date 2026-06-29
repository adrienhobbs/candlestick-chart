import { useEffect, useRef, type MutableRefObject } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { SessionsPrimitive } from '../../indicators/primitives/SessionsPrimitive';
import type { SessionsConfig } from '../../sessions/sessions';

interface UseSessionsArgs {
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  /** Resolved session config, or `null` when session shading is off. */
  config: SessionsConfig | null;
}

/**
 * Attach a {@link SessionsPrimitive} to the candlestick series for session shading +
 * day separators. Mirrors the codebase's "create-once + apply-options" split: the
 * primitive is attached once (toggled by enabled/disabled) and updated in place when
 * the config changes — never re-attached on config change (that would stack duplicates).
 */
export function useSessions({ candlestickSeriesRef, config }: UseSessionsArgs) {
  const primitiveRef = useRef<SessionsPrimitive | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const enabled = config != null;

  // Attach once when enabled (and detach when disabled / on unmount). The candlestick
  // series is created synchronously by useChartLifecycle, which runs before this hook.
  useEffect(() => {
    if (!enabled) return;
    const series = candlestickSeriesRef.current;
    const initial = configRef.current;
    if (!series || !initial) return;
    const primitive = new SessionsPrimitive(initial);
    series.attachPrimitive(primitive);
    primitiveRef.current = primitive;
    return () => {
      try {
        series.detachPrimitive(primitive);
      } catch {
        // series already disposed (e.g. chart.remove during teardown) — ignore.
      }
      primitiveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Apply config changes in place (timezone / sessions / separators).
  useEffect(() => {
    if (config) primitiveRef.current?.applyOptions(config);
  }, [config]);
}
