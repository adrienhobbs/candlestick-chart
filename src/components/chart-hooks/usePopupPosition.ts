import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { IChartApi, Time } from 'lightweight-charts';
import { ChartTrade } from '../../types/chart';

interface UsePopupPositionArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  chartContainerRef: RefObject<HTMLDivElement>;
  popupInfo: { trade: ChartTrade; time: number } | null;
  setTradePopupPos: Dispatch<SetStateAction<{ x: number } | null>>;
}

/**
 * Track the x position of the trade popup, anchored to the selected bar and
 * hidden once the bar scrolls off-screen.
 */
export function usePopupPosition({
  chartRef,
  chartContainerRef,
  popupInfo,
  setTradePopupPos,
}: UsePopupPositionArgs) {
  useEffect(() => {
    if (!chartRef.current || !popupInfo) {
      setTradePopupPos(null);
      return;
    }

    const updateTradePopupPos = () => {
      if (!chartRef.current || !popupInfo || !chartContainerRef.current) return;
      const timeScale = chartRef.current.timeScale();
      const x = timeScale.timeToCoordinate((popupInfo.time / 1000) as Time);
      // Hide when the bar is off-screen: timeToCoordinate returns null once it leaves the
      // logical range, but a bar just past the edge returns an out-of-bounds coordinate —
      // bound to [0, width] so the popup never peeks regardless of container overflow.
      const width = chartContainerRef.current.getBoundingClientRect().width;
      setTradePopupPos(x !== null && x >= 0 && x <= width ? { x } : null);
    };

    updateTradePopupPos();
    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updateTradePopupPos);
    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateTradePopupPos);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupInfo]);
}
