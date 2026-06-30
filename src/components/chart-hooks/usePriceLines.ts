import { useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import { IChartApi, IPriceLine, ISeriesApi, LineStyle, LineWidth } from 'lightweight-charts';
import { ChartLine } from '../../types/chart';
import { LINE_LABEL_RIGHT_OFFSET } from '../chart-constants';

interface UsePriceLinesArgs {
  chartRef: MutableRefObject<IChartApi | null>;
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  chartContainerRef: RefObject<HTMLDivElement>;
  lines: ChartLine[];
  /**
   * Shared map of line id → live `IPriceLine`, owned by ChartComponent so the
   * drag handler (in `useChartLifecycle`) can mutate a line's price during a
   * drag. This hook populates + reconciles it.
   */
  priceLineRefs: MutableRefObject<Map<string, IPriceLine>>;
}

/**
 * Create/reconcile the horizontal price lines for `lines`, and keep the floating
 * delete-button positions in sync as the price scale moves (scroll/zoom/resize).
 * Returns the container-relative button positions for the render. Merges the
 * original create + reposition effects; the shared coordinate→position math
 * lives in one local `computePositions` function.
 */
export function usePriceLines({
  chartRef,
  candlestickSeriesRef,
  chartContainerRef,
  lines,
  priceLineRefs,
}: UsePriceLinesArgs) {
  const [linePositions, setLinePositions] = useState<Map<string, { top: number; right: number }>>(new Map());

  // Project each line's price to a container-relative delete-button position.
  const computePositions = () => {
    if (!candlestickSeriesRef.current || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    // priceToCoordinate still returns a value when the line's price is scrolled
    // outside the visible range, so clamp to [0, containerHeight] — otherwise an
    // off-screen line's delete button renders floating at the chart edge.
    const containerHeight = chartContainerRef.current.offsetHeight;
    const newPositions = new Map<string, { top: number; right: number }>();
    lines.forEach((line) => {
      const y = candlestickSeriesRef.current?.priceToCoordinate(line.price);
      if (y !== null && y !== undefined && y >= 0 && y <= containerHeight) {
        newPositions.set(line.id, {
          top: rect.top + y,
          right: window.innerWidth - rect.right + LINE_LABEL_RIGHT_OFFSET + estimateLabelTitleWidth(line.title),
        });
      }
    });
    setLinePositions(newPositions);
  };

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    priceLineRefs.current.forEach((priceLine) => {
      candlestickSeriesRef.current?.removePriceLine(priceLine);
    });
    priceLineRefs.current.clear();

    lines.forEach((line) => {
      const priceLine = candlestickSeriesRef.current?.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: (line.lineWidth || 2) as LineWidth,
        lineStyle: getLineStyle(line.lineStyle),
        axisLabelVisible: true,
        title: line.title || '',
      });

      if (priceLine) {
        priceLineRefs.current.set(line.id, priceLine);
      }
    });

    requestAnimationFrame(() => {
      computePositions();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    const updatePositions = () => {
      computePositions();
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updatePositions);
    window.addEventListener('scroll', updatePositions, { passive: true });
    window.addEventListener('resize', updatePositions);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(updatePositions);
      window.removeEventListener('scroll', updatePositions);
      window.removeEventListener('resize', updatePositions);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  return linePositions;
}

// A price line with a `title` renders a title box to the LEFT of its on-axis
// price value, overhanging into the plot. The floating delete button is placed
// just left of the value box, so without this allowance it lands on top of the
// title text. Reserve an approximate title-box width (canvas labels can't be
// measured) so the button clears the label.
function estimateLabelTitleWidth(title?: string): number {
  if (!title) return 0;
  return title.length * 7 + 18;
}

function getLineStyle(style?: 'solid' | 'dashed' | 'dotted'): LineStyle {
  switch (style) {
    case 'dashed':
      return LineStyle.Dashed;
    case 'dotted':
      return LineStyle.Dotted;
    default:
      return LineStyle.Solid;
  }
}
