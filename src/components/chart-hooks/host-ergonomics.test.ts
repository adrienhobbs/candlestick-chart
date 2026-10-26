import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { OHLCVBar } from '../../types/chart';
import { tradeFocusFrame } from './useTradeFocus';
import { ascendingBarTimes, buildTradeOverlaysConfig } from './useTradeOverlays';
import { snapSpan } from '../trade-markers';
import { handleDialogEscape, pushDialog } from '../useDialogEscape';
import { createPersistenceAdapter } from '../../indicators/core/persistence';

const MIN5 = 5 * 60_000;
const T0 = Date.UTC(2026, 9, 22, 14, 30);
const bar = (i: number): OHLCVBar => ({ timestamp: T0 + i * MIN5, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
const series = (n: number) => Array.from({ length: n }, (_, i) => bar(i));

describe('tradeFocusFrame', () => {
  it('frames entry..exit by bar index with pad, landing each end on the bar at/after it', () => {
    const frame = tradeFocusFrame(series(50), T0 + 10 * MIN5 + 60_000, T0 + 20 * MIN5, 5);
    expect(frame).toEqual({ from: 6, to: 25, entryBarTime: T0 + 11 * MIN5, exitBarTime: T0 + 20 * MIN5 });
  });

  it('is the same frame for a new array with the same bars, and unchanged by older bars loaded in front', () => {
    const a = tradeFocusFrame(series(50), T0 + 10 * MIN5, T0 + 20 * MIN5);
    const b = tradeFocusFrame([...series(50)].reverse(), T0 + 10 * MIN5, T0 + 20 * MIN5);
    expect(b).toEqual(a);
    const older = [...Array.from({ length: 30 }, (_, i) => bar(i - 30)), ...series(50)];
    const c = tradeFocusFrame(older, T0 + 10 * MIN5, T0 + 20 * MIN5);
    expect(c?.entryBarTime).toBe(a?.entryBarTime);
    expect(c?.exitBarTime).toBe(a?.exitBarTime);
  });

  it('is null with no bars, and clamps an exit past the data to the last bar', () => {
    expect(tradeFocusFrame([], T0, T0)).toBeNull();
    expect(tradeFocusFrame(series(10), T0, T0 + 99 * MIN5, 0)?.exitBarTime).toBe(T0 + 9 * MIN5);
  });
});

describe('snapSpan / buildTradeOverlaysConfig', () => {
  const times = ascendingBarTimes(series(10));

  it('snaps both ends down to the bar containing them', () => {
    expect(snapSpan(times, T0 + MIN5 + 1000, T0 + 4 * MIN5 + 299_000)).toEqual({ start: T0 + MIN5, end: T0 + 4 * MIN5 });
  });

  it('extends a one-bar span to the next bar, and clamps a start before the data', () => {
    expect(snapSpan(times, T0 + 2 * MIN5 + 10, T0 + 2 * MIN5 + 20)).toEqual({ start: T0 + 2 * MIN5, end: T0 + 3 * MIN5 });
    expect(snapSpan(times, T0 - 3 * MIN5, T0 + MIN5)).toEqual({ start: T0, end: T0 + MIN5 });
  });

  it('drops a span that ends before the data', () => {
    expect(snapSpan(times, T0 - 9 * MIN5, T0 - MIN5)).toBeNull();
    expect(snapSpan([], T0, T0 + MIN5)).toBeNull();
  });

  it('snaps bounded lines and bands into the primitive config (seconds)', () => {
    const config = buildTradeOverlaysConfig(
      [{ id: 'stop', price: 1, color: '#f00', startTime: T0 + 60_000, endTime: T0 + 3 * MIN5 + 60_000 }],
      [
        { id: 'box', top: 2, bottom: 1, color: '#0f0', startTime: T0 + MIN5 + 1, endTime: T0 + 2 * MIN5 + 1 },
        { id: 'gone', top: 2, bottom: 1, color: '#0f0', startTime: T0 - 2 * MIN5, endTime: T0 - MIN5 },
      ],
      times,
    );
    expect(config.segments).toHaveLength(1);
    expect(config.segments[0]).toMatchObject({ startSec: T0 / 1000, endSec: (T0 + 3 * MIN5) / 1000, lineWidth: 2 });
    expect(config.boxes.map((b) => b.id)).toEqual(['box']);
    expect(config.boxes[0]).toMatchObject({ startSec: (T0 + MIN5) / 1000, endSec: (T0 + 2 * MIN5) / 1000 });
  });

  it('keeps sub-second bar times exact, matching the series time of the bar', () => {
    const odd = series(5).map((b) => ({ ...b, timestamp: b.timestamp + 437 }));
    const config = buildTradeOverlaysConfig(
      [{ id: 'entry', price: 1, color: '#fff', startTime: odd[1].timestamp, endTime: odd[3].timestamp }],
      [],
      ascendingBarTimes(odd),
    );
    expect(config.segments[0]).toMatchObject({ startSec: odd[1].timestamp / 1000, endSec: odd[3].timestamp / 1000 });
  });
});

describe('dialog Escape', () => {
  const key = (k: string) => {
    const calls = { stopped: false, prevented: false };
    const event = {
      key: k,
      stopImmediatePropagation: () => { calls.stopped = true; },
      preventDefault: () => { calls.prevented = true; },
    };
    return { event, calls };
  };

  it('closes only the innermost open dialog and stops the key', () => {
    const closed: string[] = [];
    const popOuter = pushDialog({ current: () => closed.push('outer') });
    const popInner = pushDialog({ current: () => closed.push('inner') });
    const { event, calls } = key('Escape');
    expect(handleDialogEscape(event)).toBe(true);
    expect(closed).toEqual(['inner']);
    expect(calls).toEqual({ stopped: true, prevented: true });
    popInner();
    handleDialogEscape(key('Escape').event);
    expect(closed).toEqual(['inner', 'outer']);
    popOuter();
  });

  it('lets the key through with no dialog open, or for other keys', () => {
    const { event, calls } = key('Escape');
    expect(handleDialogEscape(event)).toBe(false);
    expect(calls.stopped).toBe(false);
    const pop = pushDialog({ current: () => {} });
    expect(handleDialogEscape(key('Enter').event)).toBe(false);
    pop();
  });

  it('stops a host window listener from seeing the Escape', () => {
    let hostClosed = false;
    let dialogClosed = false;
    const host = (e: KeyboardEvent) => { if (e.key === 'Escape') hostClosed = true; };
    window.addEventListener('keydown', host);
    const pop = pushDialog({ current: () => { dialogClosed = true; } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialogClosed).toBe(true);
    expect(hostClosed).toBe(false);
    pop();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hostClosed).toBe(true);
    window.removeEventListener('keydown', host);
  });
});

describe('localStorage persistence key', () => {
  // Newer Node versions define a global `localStorage` that shadows jsdom's and is
  // unusable without a flag; stub a plain in-memory one.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps separate indicator sets under separate keys, defaulting to chart_indicators', async () => {
    const a = createPersistenceAdapter('localStorage', { key: 'a.indicators' });
    const shared = createPersistenceAdapter('localStorage');
    const ind = { id: 'x', definitionId: 'sma', settings: {}, visible: true } as never;
    await a.saveIndicators([ind]);
    expect(await shared.loadIndicators()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('a.indicators') ?? '[]')).toHaveLength(1);
    await shared.saveIndicators([ind]);
    expect(localStorage.getItem('chart_indicators')).not.toBeNull();
    await a.deleteIndicator('x');
    expect(await a.loadIndicators()).toEqual([]);
    expect(await shared.loadIndicators()).toHaveLength(1);
  });
});
