import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { CandlestickData, HistogramData, ISeriesApi, Time } from 'lightweight-charts';
import { OHLCVBar, ChartTheme } from '../../types/chart';
import { planBarsSync } from '../bars-sync-plan';

interface UseBarsSyncArgs {
  candlestickSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  volumeSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>;
  themeRef: MutableRefObject<ChartTheme>;
  isLoadingRef: MutableRefObject<boolean>;
  previousBarsRef: MutableRefObject<OHLCVBar[]>;
  previousBarsLengthRef: MutableRefObject<number>;
  setIsLoadingMore: Dispatch<SetStateAction<boolean>>;
  bars: OHLCVBar[];
}

/**
 * Sync `bars` into the candlestick + volume series, diffing against the previous
 * bars (`planBarsSync`) to choose a full `setData` vs. a single-bar `update`
 * (only the last bar changed). Owns the bars-diff trackers shared with the
 * create-once teardown (which resets them for StrictMode's double-mount).
 */
export function useBarsSync({
  candlestickSeriesRef,
  volumeSeriesRef,
  themeRef,
  isLoadingRef,
  previousBarsRef,
  previousBarsLengthRef,
  setIsLoadingMore,
  bars,
}: UseBarsSyncArgs) {
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const sortedBars = [...bars].sort((a, b) => a.timestamp - b.timestamp);

    const uniqueBars = sortedBars.reduce((acc, bar) => {
      const exists = acc.find(b => b.timestamp === bar.timestamp);
      if (!exists) {
        acc.push(bar);
      }
      return acc;
    }, [] as OHLCVBar[]);


    const plan = planBarsSync(previousBarsRef.current, uniqueBars);

    if (isLoadingRef.current && uniqueBars.length > previousBarsLengthRef.current) {
      isLoadingRef.current = false;
      setIsLoadingMore(false);
    }

    if (plan === 'set') {
      const candleData: CandlestickData[] = uniqueBars.map((bar) => ({
        time: (bar.timestamp / 1000) as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      const volumeData: HistogramData[] = uniqueBars.map((bar) => ({
        time: (bar.timestamp / 1000) as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? themeRef.current.volumeUpColor : themeRef.current.volumeDownColor,
      }));

      candlestickSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
    } else if (plan === 'update') {
      const lastBar = uniqueBars[uniqueBars.length - 1];
      const candleUpdate: CandlestickData = {
        time: (lastBar.timestamp / 1000) as Time,
        open: lastBar.open,
        high: lastBar.high,
        low: lastBar.low,
        close: lastBar.close,
      };

      const volumeUpdate: HistogramData = {
        time: (lastBar.timestamp / 1000) as Time,
        value: lastBar.volume,
        color: lastBar.close >= lastBar.open ? themeRef.current.volumeUpColor : themeRef.current.volumeDownColor,
      };

      candlestickSeriesRef.current.update(candleUpdate);
      volumeSeriesRef.current.update(volumeUpdate);
    }

    previousBarsRef.current = uniqueBars;
  }, [bars]);
}
