import { describe, it, expect } from 'vitest';
import { MUTED_MARKER_ALPHA, buildChartMarkers, buildTradeMarkers, fadeHex } from './trade-markers';

const T = (id: string, entryMs: number, exitMs: number, outcome: 'win' | 'loss') =>
  ({ id, entryTime: entryMs, exitTime: exitMs, entryPrice: 100, exitPrice: 101, outcome });

describe('buildTradeMarkers', () => {
  it('one trade → entry (belowBar/arrowUp) + exit (aboveBar/arrowDown) at the right seconds', () => {
    const m = buildTradeMarkers([T('a', 1_700_000_000_000, 1_700_000_300_000, 'win')], null);
    expect(m.length).toBe(2);
    const entry = m.find((x) => x.time === 1_700_000_000);
    const exit = m.find((x) => x.time === 1_700_000_300);
    expect(entry!.position).toBe('belowBar');
    expect(entry!.shape).toBe('arrowUp');
    expect(exit!.position).toBe('aboveBar');
    expect(exit!.shape).toBe('arrowDown');
  });

  it('win → green, loss → red (exact constants)', () => {
    const win = buildTradeMarkers([T('a', 1_000_000, 2_000_000, 'win')], null);
    const loss = buildTradeMarkers([T('b', 1_000_000, 2_000_000, 'loss')], null);
    expect(win[0].color).toBe('#10b981');
    expect(loss[0].color).toBe('#ef4444');
  });

  it('selectedTradeId labels that trade; markers are time-sorted across trades', () => {
    const trades = [T('a', 3_000_000, 9_000_000, 'win'), T('b', 1_000_000, 2_000_000, 'loss')];
    const m = buildTradeMarkers(trades, 'a');
    // ascending time (lightweight-charts requires it): b.entry(1000), b.exit(2000), a.entry(3000), a.exit(9000)
    expect(m.map((x) => x.time)).toEqual([1000, 2000, 3000, 9000]);
    // selected 'a' markers get a text label (keeping their outcome color); 'b' do not
    const aMarkers = m.filter((x) => x.time === 3000 || x.time === 9000);
    const bMarkers = m.filter((x) => x.time === 1000 || x.time === 2000);
    expect(aMarkers.every((x) => (x.text ?? '').length > 0)).toBe(true);
    expect(bMarkers.every((x) => (x.text ?? '').length === 0)).toBe(true);
  });

  it('marker colors follow the provided theme up/down colors', () => {
    const trades = [T('a', 1_000_000, 2_000_000, 'win'), T('b', 3_000_000, 4_000_000, 'loss')];
    const m = buildTradeMarkers(trades, null, { win: '#8fbc8f', loss: '#bc8f8f' });
    expect(m.find((x) => x.time === 1000)!.color).toBe('#8fbc8f');
    expect(m.find((x) => x.time === 3000)!.color).toBe('#bc8f8f');
  });

  it('empty trades → []', () => {
    expect(buildTradeMarkers([], null)).toEqual([]);
  });

  it('a muted trade keeps its outcome hue at reduced opacity', () => {
    const m = buildTradeMarkers([{ ...T('a', 1_000_000, 2_000_000, 'win'), muted: true }], null, {
      win: '#8fbc8f',
      loss: '#bc8f8f',
    });
    expect(m[0].color).toBe(`rgba(143, 188, 143, ${MUTED_MARKER_ALPHA})`);
    expect(m[1].color).toBe(m[0].color);
  });

  it('a muted trade with a non-hex color falls back to a neutral fade', () => {
    const m = buildTradeMarkers([{ ...T('a', 1_000_000, 2_000_000, 'loss'), muted: true }], null, {
      win: 'green',
      loss: 'red',
    });
    expect(m[0].color).toMatch(/^rgba\(/);
  });
});

describe('fadeHex', () => {
  it('expands short hex and replaces an existing alpha', () => {
    expect(fadeHex('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(fadeHex('#10b98159', 0.4)).toBe('rgba(16, 185, 129, 0.4)');
    expect(fadeHex('rgb(1,2,3)', 0.4)).toBeNull();
  });
});

describe('buildChartMarkers', () => {
  const bars = [1_000_000, 1_300_000, 1_600_000];

  it('snaps down to the bar at or before the time and drops markers before the first bar', () => {
    const m = buildChartMarkers(
      [
        { id: 'fill', time: 1_450_000, color: '#fff' },
        { id: 'late', time: 9_000_000, color: '#fff' },
        { id: 'early', time: 999_999, color: '#fff' },
        { id: 'nan', time: Number.NaN, color: '#fff' },
      ],
      bars,
    );
    expect(m.map((x) => [x.id, x.time])).toEqual([
      ['fill', 1_300],
      ['late', 1_600],
    ]);
  });

  it('a price draws the marker at that price; otherwise above the bar; circle by default', () => {
    const [atPrice, aboveBar] = buildChartMarkers(
      [
        { id: 'p', time: 1_000_000, price: 101.5, color: '#fff', text: 'MFE' },
        { id: 'q', time: 1_300_000, color: '#fff' },
      ],
      bars,
    );
    expect(atPrice).toMatchObject({ position: 'atPriceMiddle', price: 101.5, shape: 'circle', text: 'MFE' });
    expect(aboveBar).toMatchObject({ position: 'aboveBar', shape: 'circle', text: '' });
    expect('price' in aboveBar).toBe(false);
  });

  it('an atPrice position without a price falls back to aboveBar; explicit positions pass through', () => {
    const m = buildChartMarkers(
      [
        { id: 'a', time: 1_000_000, position: 'atPriceTop', color: '#fff' },
        { id: 'b', time: 1_300_000, position: 'belowBar', shape: 'arrowUp', color: '#fff', size: 2 },
      ],
      bars,
    );
    expect(m[0].position).toBe('aboveBar');
    expect(m[1]).toMatchObject({ position: 'belowBar', shape: 'arrowUp', size: 2 });
  });

  it('is sorted by time and empty without bars', () => {
    const m = buildChartMarkers(
      [
        { id: 'z', time: 1_600_000, color: '#fff' },
        { id: 'a', time: 1_000_000, color: '#fff' },
      ],
      bars,
    );
    expect(m.map((x) => x.id)).toEqual(['a', 'z']);
    expect(buildChartMarkers([{ id: 'a', time: 1, color: '#fff' }], [])).toEqual([]);
  });
});
