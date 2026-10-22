import { useEffect, useMemo, type MutableRefObject } from 'react';
import { SeriesMarker, Time } from 'lightweight-charts';
import { OHLCVBar, ChartMarker, ChartTrade, ChartTheme } from '../../types/chart';
import { buildChartMarkers, buildTradeMarkers } from '../trade-markers';

interface UseTradeMarkersArgs {
  seriesMarkersRef: MutableRefObject<any>;
  bars: OHLCVBar[];
  trades: ChartTrade[];
  markers: ChartMarker[];
  selectedTradeId: string | null;
  selectedBar: OHLCVBar | null;
  enableBarSelection: boolean;
  resolvedTheme: ChartTheme;
}

/**
 * Set the series markers: win/loss trade entry/exit markers (tinted by the
 * theme's up/down colors), the host's free-standing `markers` (snapped to bar
 * times), plus the selected-bar marker, sorted ascending by time as
 * lightweight-charts requires.
 */
export function useTradeMarkers({
  seriesMarkersRef,
  bars,
  trades,
  markers,
  selectedTradeId,
  selectedBar,
  enableBarSelection,
  resolvedTheme,
}: UseTradeMarkersArgs) {
  const barTimes = useMemo(
    () => [...new Set(bars.map((b) => b.timestamp))].sort((a, b) => a - b),
    [bars],
  );
  useEffect(() => {
    if (!seriesMarkersRef.current) return;
    // Win/loss markers track the theme's up/down candle colors.
    const tradeMarkers = buildTradeMarkers(trades, selectedTradeId, {
      win: resolvedTheme.upColor,
      loss: resolvedTheme.downColor,
    });
    const hostMarkers = buildChartMarkers(markers, barTimes);
    const selectionMarker: SeriesMarker<Time>[] =
      enableBarSelection && selectedBar
        ? [
            {
              time: (selectedBar.timestamp / 1000) as Time,
              position: 'aboveBar' as const,
              color: resolvedTheme.crosshairColor,
              shape: 'circle' as const,
              text: '',
            },
          ]
        : [];
    const all = [...tradeMarkers, ...hostMarkers, ...selectionMarker].sort(
      (a, b) => (a.time as number) - (b.time as number),
    );
    seriesMarkersRef.current.setMarkers(all);
  }, [trades, markers, barTimes, selectedTradeId, selectedBar, enableBarSelection, resolvedTheme]);
}
