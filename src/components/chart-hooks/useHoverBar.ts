import { useEffect, useRef, type MutableRefObject } from 'react';
import { IChartApi, MouseEventParams, Time } from 'lightweight-charts';

interface UseHoverBarArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  /** Fired with the hovered bar's time (epoch ms), or null when the cursor leaves. */
  onHoverBar?: (timeMs: number | null) => void;
}

/**
 * Surface the crosshair's hovered bar time (epoch ms) to the host via `onHoverBar`,
 * so it can drive selection-like UI (e.g. show a trade's overlays while hovering its
 * bars). Same crosshair subscription the OHLC legend uses; `param.time` is in seconds
 * (×1000 → ms), and `undefined` (cursor off a bar) maps to `null`.
 */
export function useHoverBar({ chartRef, onHoverBar }: UseHoverBarArgs) {
  const cbRef = useRef(onHoverBar);
  cbRef.current = onHoverBar;
  const enabled = onHoverBar != null;

  useEffect(() => {
    if (!enabled) return;
    const chart = chartRef.current;
    if (!chart) return;
    const onMove = (param: MouseEventParams<Time>) => {
      cbRef.current?.(param.time === undefined ? null : (param.time as number) * 1000);
    };
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
