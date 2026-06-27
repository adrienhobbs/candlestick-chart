import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTradeMarkers } from './trade-markers';

const T = (id: string, entryMs: number, exitMs: number, outcome: 'win' | 'loss') =>
  ({ id, entryTime: entryMs, exitTime: exitMs, entryPrice: 100, exitPrice: 101, outcome });

test('one trade → entry (belowBar/arrowUp) + exit (aboveBar/arrowDown) at the right seconds', () => {
  const m = buildTradeMarkers([T('a', 1_700_000_000_000, 1_700_000_300_000, 'win')], null);
  assert.equal(m.length, 2);
  const entry = m.find((x) => x.time === 1_700_000_000);
  const exit = m.find((x) => x.time === 1_700_000_300);
  assert.equal(entry!.position, 'belowBar');
  assert.equal(entry!.shape, 'arrowUp');
  assert.equal(exit!.position, 'aboveBar');
  assert.equal(exit!.shape, 'arrowDown');
});

test('win → green, loss → red (exact constants)', () => {
  const win = buildTradeMarkers([T('a', 1_000_000, 2_000_000, 'win')], null);
  const loss = buildTradeMarkers([T('b', 1_000_000, 2_000_000, 'loss')], null);
  assert.equal(win[0].color, '#10b981');
  assert.equal(loss[0].color, '#ef4444');
});

test('selectedTradeId emphasizes that trade; markers are time-sorted across trades', () => {
  const trades = [T('a', 3_000_000, 9_000_000, 'win'), T('b', 1_000_000, 2_000_000, 'loss')];
  const m = buildTradeMarkers(trades, 'a');
  // ascending time (lightweight-charts requires it): b.entry(1000), b.exit(2000), a.entry(3000), a.exit(9000)
  assert.deepEqual(m.map((x) => x.time), [1000, 2000, 3000, 9000]);
  // selected 'a' markers get the emphasis color + a text label; 'b' do not
  const aMarkers = m.filter((x) => x.time === 3000 || x.time === 9000);
  const bMarkers = m.filter((x) => x.time === 1000 || x.time === 2000);
  assert.ok(aMarkers.every((x) => x.color === '#3b82f6' && (x.text ?? '').length > 0));
  assert.ok(bMarkers.every((x) => (x.text ?? '').length === 0));
});

test('empty trades → []', () => {
  assert.deepEqual(buildTradeMarkers([], null), []);
});
