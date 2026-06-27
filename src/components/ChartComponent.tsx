import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  createChart,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LineData,
  HistogramData,
  IPriceLine,
  LineStyle,
  LineWidth,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  SeriesMarker,
} from 'lightweight-charts';
import { OHLCVBar, ChartLine, ChartTrade } from '../types/chart';
import { IndicatorInstance } from '../indicators/core/types';
import { indicatorRegistry } from '../indicators/core/registry';
import { indicatorCalculator } from '../indicators/core/calculator';
import { BandsPrimitive } from '../indicators/primitives/BandsPrimitive';
import { buildTradeMarkers } from './trade-markers';

interface ChartComponentProps {
  bars: OHLCVBar[];
  onLoadMoreData?: (oldestTimestamp: number) => void;
  indicators?: IndicatorInstance[];
  lines?: ChartLine[];
  onBarUpdate?: (updatedBar: OHLCVBar) => void;
  onNewBar?: (newBar: OHLCVBar) => void;
  onDeleteLine?: (lineId: string) => void;
  onAddLine?: (type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance', price: number) => void;
  onClearAllLines?: () => void;
  enableBarSelection?: boolean;
  onBarClick?: (bar: OHLCVBar | null) => void;
  trades?: ChartTrade[];
  selectedTradeId?: string | null;
  renderTradePopup?: (trade: ChartTrade) => ReactNode;
}

export default function ChartComponent({
  bars,
  onLoadMoreData,
  indicators = [],
  lines = [],
  onBarUpdate,
  onNewBar,
  onDeleteLine,
  onAddLine,
  onClearAllLines,
  enableBarSelection = true,
  onBarClick,
  trades = [],
  selectedTradeId = null,
  renderTradePopup,
}: ChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const indicatorPaneIndexRef = useRef<Map<string, number>>(new Map());
  const nextPaneIndexRef = useRef<number>(2);
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map());
  const seriesMarkersRef = useRef<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);
  const [linePositions, setLinePositions] = useState<Map<string, { top: number; right: number }>>(new Map());
  const [selectedBar, setSelectedBar] = useState<OHLCVBar | null>(null);
  const selectedBarRef = useRef<OHLCVBar | null>(null);
  const [spotlightPosition, setSpotlightPosition] = useState<{ x: number; width: number } | null>(null);
  const [tradePopupPos, setTradePopupPos] = useState<{ x: number } | null>(null);
  const previousBarsRef = useRef<OHLCVBar[]>([]);
  const previousBarsLengthRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const barsRef = useRef<OHLCVBar[]>(bars);
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);


  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartContainerRef.current.style.position = 'relative';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
        panes: {
          enableResize: true,
          separatorColor: '#1e293b',
          separatorHoverColor: 'rgba(148,163,184,0.5)',
        },
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#334155',
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: '#475569',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: '#475569',
          style: 3,
        },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    }, 0);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#64748b',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    }, 1);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    seriesMarkersRef.current = createSeriesMarkers(candlestickSeries, []);

    chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      if (logicalRange && logicalRange.from < 5 && !isLoadingRef.current && onLoadMoreData) {
        console.log('Triggering load more, logicalRange.from:', logicalRange.from);
        isLoadingRef.current = true;
        setIsLoadingMore(true);
        previousBarsLengthRef.current = barsRef.current.length;
        console.log('Set previousBarsLengthRef to:', previousBarsLengthRef.current);
        const sortedBars = [...barsRef.current].sort((a, b) => a.timestamp - b.timestamp);
        const oldestTimestamp = sortedBars[0]?.timestamp;
        if (oldestTimestamp) {
          onLoadMoreData(oldestTimestamp);
        }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      console.log('Context menu event triggered!', e);
      e.preventDefault();
      e.stopPropagation();

      if (!candlestickSeriesRef.current) {
        console.log('No candlestick series yet');
        return;
      }

      const rect = chartContainerRef.current!.getBoundingClientRect();
      const y = e.clientY - rect.top;
      console.log('Y position:', y, 'Rect:', rect);

      const price = candlestickSeriesRef.current.coordinateToPrice(y);
      console.log('Calculated price:', price);

      if (price !== null) {
        setContextMenu({
          x: e.clientX - rect.left,
          y: y,
          price: price as number,
        });
        console.log('Context menu set:', { x: e.clientX - rect.left, y, price });
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > 5 || dy > 5) {
          isDraggingRef.current = true;
        }
      }
    };

    const handleMouseUp = () => {
      mouseDownPosRef.current = null;
    };

    const handleClick = (e: MouseEvent) => {
      console.log('=== CLICK DEBUG START ===');
      console.log('Click event - closing context menu');
      setContextMenu(null);

      if (isDraggingRef.current) {
        console.log('Ignoring click - user was dragging');
        isDraggingRef.current = false;
        return;
      }

      console.log('enableBarSelection prop:', enableBarSelection);
      console.log('chartRef.current:', !!chartRef.current);
      console.log('candlestickSeriesRef.current:', !!candlestickSeriesRef.current);
      console.log('bars.length:', bars.length);

      if (!enableBarSelection) {
        console.log('Bar selection is DISABLED - exiting');
        return;
      }

      if (!chartRef.current) {
        console.log('Chart ref is NULL - exiting');
        return;
      }

      if (!candlestickSeriesRef.current) {
        console.log('Candlestick series ref is NULL - exiting');
        return;
      }

      console.log('All checks passed - proceeding with bar selection');

      const rect = chartContainerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      console.log('Click X coordinate:', x);

      const timeScale = chartRef.current.timeScale();
      const coordinate = timeScale.coordinateToTime(x);
      console.log('Coordinate from timeScale:', coordinate);

      if (!coordinate) {
        console.log('No coordinate from timeScale - exiting');
        return;
      }

      const clickedTime = coordinate as number;
      console.log('Clicked time:', clickedTime);
      console.log('Sample bar timestamps (first 3):', barsRef.current.slice(0, 3).map(b => b.timestamp / 1000));

      const clickedBar = barsRef.current.find(bar => {
        const diff = Math.abs((bar.timestamp / 1000) - clickedTime);
        return diff < 300;
      });

      console.log('Clicked bar found:', !!clickedBar);
      if (clickedBar) {
        console.log('Clicked bar details:', clickedBar);
        console.log('Current selectedBarRef.current:', selectedBarRef.current);

        if (selectedBarRef.current && selectedBarRef.current.timestamp === clickedBar.timestamp) {
          console.log('Deselecting bar (same bar clicked)');
          selectedBarRef.current = null;
          setSelectedBar(null);
          setSpotlightPosition(null);
          if (onBarClick) {
            onBarClick(null);
          }
        } else {
          console.log('Selecting new bar');
          selectedBarRef.current = clickedBar;
          setSelectedBar(clickedBar);
          const barX = timeScale.timeToCoordinate((clickedBar.timestamp / 1000) as Time);
          console.log('Bar X position:', barX);
          if (barX !== null) {
            const barWidth = Math.max(8, rect.width / barsRef.current.length);
            console.log('Bar width:', barWidth);
            setSpotlightPosition({ x: barX - barWidth / 2, width: barWidth });
          }
          if (onBarClick) {
            onBarClick(clickedBar);
          }
        }
      } else {
        console.log('No bar found at clicked position');
      }
      console.log('=== CLICK DEBUG END ===');
    };

    window.addEventListener('resize', handleResize);
    chartContainerRef.current.addEventListener('contextmenu', handleContextMenu, true);
    chartContainerRef.current.addEventListener('mousedown', handleMouseDown, true);
    chartContainerRef.current.addEventListener('mousemove', handleMouseMove, true);
    chartContainerRef.current.addEventListener('mouseup', handleMouseUp, true);
    chartContainerRef.current.addEventListener('click', handleClick, true);

    const container = chartContainerRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('contextmenu', handleContextMenu, true);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mousemove', handleMouseMove, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('click', handleClick, true);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

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

    console.log('Debug - bars.length:', bars.length, 'uniqueBars.length:', uniqueBars.length, 'isLoadingRef:', isLoadingRef.current, 'previousBarsLength:', previousBarsLengthRef.current);

    const previousBars = previousBarsRef.current;
    const isInitialLoad = previousBars.length === 0;
    const hasNewBars = uniqueBars.length > previousBars.length;
    const lastBarChanged = uniqueBars.length > 0 && previousBars.length > 0 &&
      (uniqueBars[uniqueBars.length - 1].timestamp === previousBars[previousBars.length - 1].timestamp);

    console.log('isInitialLoad:', isInitialLoad, 'hasNewBars:', hasNewBars, 'lastBarChanged:', lastBarChanged);
    console.log('previousBars.length:', previousBars.length, 'uniqueBars.length:', uniqueBars.length);

    if (isLoadingRef.current && uniqueBars.length > previousBarsLengthRef.current) {
      console.log('Hiding loading indicator');
      isLoadingRef.current = false;
      setIsLoadingMore(false);
    }

    const firstBarChanged = uniqueBars.length > 0 && previousBars.length > 0 &&
      (uniqueBars[0].timestamp !== previousBars[0].timestamp);

    if (isInitialLoad || hasNewBars) {
      console.log('Setting data with', uniqueBars.length, 'bars', 'firstBarChanged:', firstBarChanged);
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
        color: bar.close >= bar.open ? '#10b98180' : '#ef444480',
      }));

      console.log('candleData sample (first 3):', candleData.slice(0, 3));
      console.log('candleData sample (last 3):', candleData.slice(-3));
      candlestickSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
    } else if (lastBarChanged && uniqueBars.length > 0 && !hasNewBars) {
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
        color: lastBar.close >= lastBar.open ? '#10b98180' : '#ef444480',
      };

      candlestickSeriesRef.current.update(candleUpdate);
      volumeSeriesRef.current.update(volumeUpdate);
    }

    previousBarsRef.current = uniqueBars;
  }, [bars]);

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
      if (!candlestickSeriesRef.current || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const newPositions = new Map<string, { top: number; right: number }>();
      lines.forEach((line) => {
        const y = candlestickSeriesRef.current?.priceToCoordinate(line.price);
        if (y !== null && y !== undefined) {
          newPositions.set(line.id, {
            top: rect.top + y,
            right: window.innerWidth - rect.right + 68,
          });
        }
      });
      setLinePositions(newPositions);
    });
  }, [lines]);

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    const updatePositions = () => {
      if (!candlestickSeriesRef.current || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const newPositions = new Map<string, { top: number; right: number }>();
      lines.forEach((line) => {
        const y = candlestickSeriesRef.current?.priceToCoordinate(line.price);
        if (y !== null && y !== undefined) {
          newPositions.set(line.id, {
            top: rect.top + y,
            right: window.innerWidth - rect.right + 68,
          });
        }
      });
      setLinePositions(newPositions);
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updatePositions);
    window.addEventListener('scroll', updatePositions, { passive: true });
    window.addEventListener('resize', updatePositions);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(updatePositions);
      window.removeEventListener('scroll', updatePositions);
      window.removeEventListener('resize', updatePositions);
    };
  }, [lines]);

  useEffect(() => {
    if (!chartRef.current) return;

    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    indicatorSeriesRef.current.clear();
    indicatorPaneIndexRef.current.clear();
    nextPaneIndexRef.current = 2;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      const seriesType = definition.renderConfig.seriesType;
      const isOverlay = definition.renderConfig.overlay !== false;
      const paneIndex = isOverlay ? 0 : nextPaneIndexRef.current;

      if (!isOverlay) {
        indicatorPaneIndexRef.current.set(indicator.id, paneIndex);
        nextPaneIndexRef.current++;
      }

      if (seriesType === 'line') {
        if (definition.renderConfig.outputCount === 1) {
          const series = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.color || '#3b82f6',
            lineWidth: indicator.settings.lineWidth || 2,
            title: indicator.name,
          }, paneIndex);
          const lineData = data.map(d => ({ time: d.time as Time, value: d.value }));
          series.setData(lineData as LineData[]);
          indicatorSeriesRef.current.set(indicator.id, series);
        } else if (definition.renderConfig.hasBandFill && definition.renderConfig.fillBands) {
          const { upper: upperField, lower: lowerField } = definition.renderConfig.fillBands;

          const upperSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.upperColor || '#ef4444',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Upper`,
          }, paneIndex);
          const middleSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.middleColor || indicator.settings.vwapColor || '#3b82f6',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Middle`,
          }, paneIndex);
          const lowerSeries = chartRef.current!.addSeries(LineSeries, {
            color: indicator.settings.lowerColor || '#10b981',
            lineWidth: indicator.settings.lineWidth || 2,
            title: `${indicator.name} Lower`,
          }, paneIndex);

          const upperData = data.map(d => ({ time: d.time as Time, value: d[upperField] })).filter(d => !isNaN(d.value));
          const middleData = data.map(d => ({ time: d.time as Time, value: d.value })).filter(d => !isNaN(d.value));
          const lowerData = data.map(d => ({ time: d.time as Time, value: d[lowerField] })).filter(d => !isNaN(d.value));

          upperSeries.setData(upperData as LineData[]);
          middleSeries.setData(middleData as LineData[]);
          lowerSeries.setData(lowerData as LineData[]);

          if (indicator.settings.showFill !== false) {
            const bandsPrimitive = new BandsPrimitive({
              upperSeries: upperSeries,
              lowerSeries: lowerSeries,
              fillColor: indicator.settings.fillColor || 'rgba(59, 130, 246, 0.1)',
            });
            upperSeries.attachPrimitive(bandsPrimitive);
          }

          indicatorSeriesRef.current.set(`${indicator.id}-upper`, upperSeries);
          indicatorSeriesRef.current.set(`${indicator.id}-middle`, middleSeries);
          indicatorSeriesRef.current.set(`${indicator.id}-lower`, lowerSeries);
        }
      } else if (seriesType === 'histogram') {
        const series = chartRef.current!.addSeries(HistogramSeries, {
          color: indicator.settings.color || '#8b5cf6',
          title: indicator.name,
        }, paneIndex);
        const histData = data.map(d => ({ time: d.time as Time, value: d.value }));
        series.setData(histData as HistogramData[]);
        indicatorSeriesRef.current.set(indicator.id, series);
      } else if (seriesType === 'area') {
        const series = chartRef.current!.addSeries(AreaSeries, {
          topColor: indicator.settings.topColor || '#3b82f680',
          bottomColor: indicator.settings.bottomColor || '#3b82f600',
          lineColor: indicator.settings.lineColor || '#3b82f6',
          lineWidth: indicator.settings.lineWidth || 2,
          title: indicator.name,
        }, paneIndex);
        const areaData = data.map(d => ({ time: d.time as Time, value: d.value }));
        series.setData(areaData as LineData[]);
        indicatorSeriesRef.current.set(indicator.id, series);
      }
    });
  }, [indicators]);

  useEffect(() => {
    if (!chartRef.current || indicators.length === 0) return;

    indicators.forEach((indicator) => {
      const definition = indicatorRegistry.get(indicator.definitionId);
      if (!definition) return;

      const data = indicatorCalculator.calculate(indicator, barsRef.current);
      if (!data || data.length === 0) return;

      if (definition.renderConfig.outputCount === 1) {
        const series = indicatorSeriesRef.current.get(indicator.id);
        if (series) {
          const lineData = data.map(d => ({ time: d.time as Time, value: d.value }));
          series.setData(lineData as any);
        }
      } else if (definition.renderConfig.hasBandFill && definition.renderConfig.fillBands) {
        const { upper: upperField, lower: lowerField } = definition.renderConfig.fillBands;

        const upperSeries = indicatorSeriesRef.current.get(`${indicator.id}-upper`);
        const middleSeries = indicatorSeriesRef.current.get(`${indicator.id}-middle`);
        const lowerSeries = indicatorSeriesRef.current.get(`${indicator.id}-lower`);

        if (upperSeries && middleSeries && lowerSeries) {
          const upperData = data.map(d => ({ time: d.time as Time, value: d[upperField] })).filter(d => !isNaN(d.value));
          const middleData = data.map(d => ({ time: d.time as Time, value: d.value })).filter(d => !isNaN(d.value));
          const lowerData = data.map(d => ({ time: d.time as Time, value: d[lowerField] })).filter(d => !isNaN(d.value));

          upperSeries.setData(upperData as any);
          middleSeries.setData(middleData as any);
          lowerSeries.setData(lowerData as any);
        }
      }
    });
  }, [bars, indicators]);

  useEffect(() => {
    if (!seriesMarkersRef.current) return;
    const tradeMarkers = buildTradeMarkers(trades, selectedTradeId);
    const selectionMarker: SeriesMarker<Time>[] =
      enableBarSelection && selectedBar
        ? [
            {
              time: (selectedBar.timestamp / 1000) as Time,
              position: 'aboveBar' as const,
              color: '#3b82f6',
              shape: 'circle' as const,
              text: '',
            },
          ]
        : [];
    const all = [...tradeMarkers, ...selectionMarker].sort(
      (a, b) => (a.time as number) - (b.time as number),
    );
    seriesMarkersRef.current.setMarkers(all);
  }, [trades, selectedTradeId, selectedBar, enableBarSelection]);

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
        const barWidth = Math.max(8, rect.width / bars.length);
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
  }, [selectedBar, enableBarSelection, bars.length]);

  const selectedTrade = trades.find((t) => t.id === selectedTradeId) ?? null;

  useEffect(() => {
    if (!chartRef.current || !selectedTrade) {
      setTradePopupPos(null);
      return;
    }

    const updateTradePopupPos = () => {
      if (!chartRef.current || !selectedTrade) return;
      const timeScale = chartRef.current.timeScale();
      const x = timeScale.timeToCoordinate((selectedTrade.entryTime / 1000) as Time);
      // off-screen (bar scrolled out of view) → timeToCoordinate returns null → hide
      setTradePopupPos(x !== null ? { x } : null);
    };

    updateTradePopupPos();
    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updateTradePopupPos);
    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateTradePopupPos);
      }
    };
  }, [selectedTrade, selectedTrade?.entryTime]);

  const handleDeleteLine = (lineId: string) => {
    if (onDeleteLine) {
      onDeleteLine(lineId);
    }
  };

  const handleAddLineFromContext = (type: 'entry' | 'stopLoss' | 'takeProfit' | 'support' | 'resistance') => {
    if (onAddLine && contextMenu) {
      onAddLine(type, contextMenu.price);
      setContextMenu(null);
    }
  };

  const handleClearAllLines = () => {
    if (onClearAllLines) {
      onClearAllLines();
      setContextMenu(null);
    }
  };

  return (
    <div className="relative space-y-4">
      {isLoadingMore && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-slate-200 px-4 py-2 rounded-lg shadow-lg z-10">
          Loading more data...
        </div>
      )}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />

        {enableBarSelection && spotlightPosition && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-5"
            style={{
              left: `${spotlightPosition.x}px`,
              width: `${spotlightPosition.width}px`,
              background: 'rgba(59, 130, 246, 0.15)',
              borderLeft: '1px solid rgba(59, 130, 246, 0.4)',
              borderRight: '1px solid rgba(59, 130, 246, 0.4)',
            }}
          />
        )}

        {selectedTrade && tradePopupPos && renderTradePopup && (
          <div
            className="absolute z-20 pointer-events-auto"
            style={{ left: `${tradePopupPos.x}px`, top: 8, transform: 'translateX(-50%)' }}
          >
            {renderTradePopup(selectedTrade)}
          </div>
        )}
      </div>

      {chartContainerRef.current && lines.map((line) => {
        const pos = linePositions.get(line.id);
        if (!pos) return null;

        return createPortal(
          <button
            key={line.id}
            onClick={() => handleDeleteLine(line.id)}
            className="bg-red-500/70 hover:bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors shadow-md"
            style={{
              position: 'fixed',
              top: `${pos.top - 8}px`,
              right: `${pos.right}px`,
              zIndex: 9999,
            }}
            title="Delete line"
          >
            ×
          </button>,
          document.body
        );
      })}

      {contextMenu && (
        <div
          className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-30 py-1 min-w-[180px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-600">
            Price: {contextMenu.price.toFixed(3)}
          </div>
          <button
            onClick={() => handleAddLineFromContext('entry')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Entry Line
          </button>
          <button
            onClick={() => handleAddLineFromContext('stopLoss')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Stop Loss
          </button>
          <button
            onClick={() => handleAddLineFromContext('takeProfit')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Take Profit
          </button>
          <div className="border-t border-slate-600 my-1"></div>
          <button
            onClick={() => handleAddLineFromContext('support')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Support Line
          </button>
          <button
            onClick={() => handleAddLineFromContext('resistance')}
            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Add Resistance Line
          </button>
          <div className="border-t border-slate-600 my-1"></div>
          <button
            onClick={handleClearAllLines}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors"
          >
            Clear All Lines
          </button>
        </div>
      )}
    </div>
  );
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
