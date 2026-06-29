import { describe, it, expect } from 'vitest';
import { buildTradeMarkers } from './trade-markers';

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
});
