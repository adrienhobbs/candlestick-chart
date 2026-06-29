import type { ChartTheme } from '../types/chart';
import type { OhlcLegendData } from './ohlcLegendData';

interface OhlcLegendProps {
  data: OhlcLegendData;
  theme: ChartTheme;
  timeZone?: string;
}

const fmtNum = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtVol = (v: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);

function formatTime(timeSec: number | null, timeZone?: string): string {
  if (timeSec == null) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timeSec * 1000));
}

/**
 * Default crosshair OHLC legend (a styled box; positioning is handled by the host
 * overlay). Override entirely via ChartComponent's `renderOhlcLegend` prop.
 */
export default function OhlcLegend({ data, theme, timeZone }: OhlcLegendProps) {
  const up = data.close >= data.open;
  const stateColor = up ? theme.upColor : theme.downColor;
  const sign = up ? '+' : '';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '4px 6px',
        fontSize: 11,
        lineHeight: 1.4,
        fontFamily: theme.fontFamily,
        color: theme.textColor,
        background: theme.background,
        border: `1px solid ${theme.axisBorderColor}`,
      }}
    >
      {data.time != null && <div style={{ opacity: 0.7 }}>{formatTime(data.time, timeZone)}</div>}
      <div style={{ display: 'flex', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
        <span>
          O <b>{fmtNum(data.open)}</b>
        </span>
        <span>
          H <b>{fmtNum(data.high)}</b>
        </span>
        <span>
          L <b>{fmtNum(data.low)}</b>
        </span>
        <span>
          C <b style={{ color: stateColor }}>{fmtNum(data.close)}</b>
        </span>
        <span style={{ color: stateColor }}>
          {sign}
          {fmtNum(data.changeAbs)} ({sign}
          {data.changePct.toFixed(2)}%)
        </span>
      </div>
      {data.volume != null && (
        <div style={{ opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>Vol {fmtVol(data.volume)}</div>
      )}
      {data.indicators.map((ind, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 2, background: ind.color, display: 'inline-block', flex: '0 0 auto' }} />
          <span>{ind.label}</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(ind.value)}</span>
        </div>
      ))}
    </div>
  );
}
