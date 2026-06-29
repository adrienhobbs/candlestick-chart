import { useEffect, type MutableRefObject } from 'react';
import { SeriesMarker, Time } from 'lightweight-charts';
import { OHLCVBar, ChartTrade, ChartTheme } from '../../types/chart';
import { buildTradeMarkers } from '../trade-markers';

interface UseTradeMarkersArgs {
  seriesMarkersRef: MutableRefObject<any>;
  trades: ChartTrade[];
  selectedTradeId: string | null;
  selectedBar: OHLCVBar | null;
  enableBarSelection: boolean;
  resolvedTheme: ChartTheme;
}

/**
 * Set the series markers: win/loss trade entry/exit markers (tinted by the
 * theme's up/down colors) plus the selected-bar marker, sorted ascending by
 * time as lightweight-charts requires.
 */
export function useTradeMarkers({
  seriesMarkersRef,
  trades,
  selectedTradeId,
  selectedBar,
  enableBarSelection,
  resolvedTheme,
}: UseTradeMarkersArgs) {
  useEffect(() => {
    if (!seriesMarkersRef.current) return;
    // Win/loss markers track the theme's up/down candle colors.
    const tradeMarkers = buildTradeMarkers(trades, selectedTradeId, {
      win: resolvedTheme.upColor,
      loss: resolvedTheme.downColor,
    });
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
    const all = [...tradeMarkers, ...selectionMarker].sort(
      (a, b) => (a.time as number) - (b.time as number),
    );
    seriesMarkersRef.current.setMarkers(all);
  }, [trades, selectedTradeId, selectedBar, enableBarSelection, resolvedTheme]);
}
