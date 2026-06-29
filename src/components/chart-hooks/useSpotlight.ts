import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { IChartApi, Time } from 'lightweight-charts';
import { OHLCVBar } from '../../types/chart';
import { MIN_SPOTLIGHT_WIDTH } from '../chart-constants';

interface UseSpotlightArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  chartContainerRef: RefObject<HTMLDivElement>;
  selectedBar: OHLCVBar | null;
  enableBarSelection: boolean;
  bars: OHLCVBar[];
  setSpotlightPosition: Dispatch<SetStateAction<{ x: number; width: number } | null>>;
}

/**
 * Track the selected-bar spotlight overlay's x/width, recomputing as the time
 * scale moves so the highlight stays glued to the bar.
 */
export function useSpotlight({
  chartRef,
  chartContainerRef,
  selectedBar,
  enableBarSelection,
  bars,
  setSpotlightPosition,
}: UseSpotlightArgs) {
  useEffect(() => {
    if (!chartRef.current || !selectedBar || !enableBarSelection) {
      setSpotlightPosition(null);
      return;
    }

    const updateSpotlightPosition = () => {
      if (!chartRef.current || !selectedBar || !chartContainerRef.current) return;

      const timeScale = chartRef.current.timeScale();
      const barX = timeScale.timeToCoordinate((selectedBar.timestamp / 1000) as Time);

      if (barX !== null) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const barWidth = Math.max(MIN_SPOTLIGHT_WIDTH, rect.width / bars.length);
        setSpotlightPosition({ x: barX - barWidth / 2, width: barWidth });
      }
    };

    updateSpotlightPosition();

    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updateSpotlightPosition);

    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateSpotlightPosition);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBar, enableBarSelection, bars.length]);
}
