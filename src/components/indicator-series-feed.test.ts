import { describe, it, expect, vi } from 'vitest';
import { createSeriesFeeder, tailStart } from './indicator-series-feed';

const p = (time: number, value?: number) => (value === undefined ? { time } : { time, value });
const line = (n: number) => Array.from({ length: n }, (_, i) => p(i, i * 10));

describe('tailStart', () => {
  it('is the length when nothing changed', () => {
    expect(tailStart(line(4), line(4))).toBe(4);
  });

  it('starts at the last point when only it changed, and at the old last on an append', () => {
    expect(tailStart(line(4), [...line(3), p(3, 99)])).toBe(3);
    expect(tailStart(line(4), [...line(4), p(4, 1)])).toBe(4);
    expect(tailStart(line(4), [...line(3), p(3, 99), p(4, 1)])).toBe(3);
  });

  it('is null when an earlier point changed, the series shrank, or the last time moved', () => {
    expect(tailStart(line(4), [p(0, 1), ...line(4).slice(1)])).toBeNull();
    expect(tailStart(line(4), line(3))).toBeNull();
    expect(tailStart(line(4), [...line(3), p(5, 30)])).toBeNull();
    expect(tailStart([], line(2))).toBeNull();
  });

  it('is null for new points out of time order or too many of them', () => {
    expect(tailStart(line(4), [...line(4), p(3, 1)])).toBeNull();
    expect(tailStart(line(4), line(8))).toBeNull();
  });

  it('treats a value turning into whitespace as a change at that point', () => {
    expect(tailStart(line(4), [...line(3), p(3)])).toBe(3);
  });
});

describe('createSeriesFeeder', () => {
  const sink = () => ({ setData: vi.fn(), update: vi.fn() });

  it('updates the tail on a tail plan, sets otherwise, and skips unchanged data', () => {
    const feeder = createSeriesFeeder();
    const s = sink();
    feeder.set(s, line(4));
    feeder.sync(s, line(4), 'set');
    expect(s.setData).toHaveBeenCalledTimes(1);
    feeder.sync(s, line(5), 'append');
    expect(s.update.mock.calls).toEqual([[p(4, 40)]]);
    feeder.sync(s, line(6), 'set');
    expect(s.setData).toHaveBeenCalledTimes(2);
    feeder.sync(s, line(7), null);
    expect(s.setData).toHaveBeenCalledTimes(3);
  });

  it('sets a series it has not fed before', () => {
    const feeder = createSeriesFeeder();
    const s = sink();
    feeder.sync(s, line(3), 'update');
    expect(s.setData).toHaveBeenCalledTimes(1);
    expect(s.update).not.toHaveBeenCalled();
  });
});

describe('createSeriesFeeder review fixes', () => {
  const sink = () => ({ setData: vi.fn(), update: vi.fn() });

  it('treats a missing field and an undefined one as the same, both ways', () => {
    const a = [p(0, 1), { time: 1, value: undefined }];
    const b = [p(0, 1), p(1)];
    expect(tailStart(a, b)).toBe(2);
    expect(tailStart(b, a)).toBe(2);
  });

  it('falls back to setData when update() throws partway, and remembers the data', () => {
    const feeder = createSeriesFeeder();
    const s = sink();
    feeder.set(s, line(4));
    s.update.mockImplementationOnce(() => {}).mockImplementationOnce(() => {
      throw new Error('Cannot update oldest data');
    });
    const next = [...line(3), p(3, 99), p(4, 1)];
    feeder.sync(s, next, 'append');
    expect(s.update).toHaveBeenCalledTimes(2);
    expect(s.setData).toHaveBeenLastCalledWith(next);
    s.update.mockClear();
    feeder.sync(s, [...line(3), p(3, 99), p(4, 2)], 'update');
    expect(s.update.mock.calls).toEqual([[p(4, 2)]]);
  });

  it('leaves an empty series alone while it stays empty', () => {
    const feeder = createSeriesFeeder();
    const s = sink();
    feeder.set(s, []);
    feeder.sync(s, [], 'update');
    feeder.sync(s, [], 'set');
    expect(s.setData).toHaveBeenCalledTimes(1);
    feeder.sync(s, line(1), 'update');
    expect(s.setData).toHaveBeenCalledTimes(2);
  });
});

describe('createSeriesFeeder when setData throws', () => {
  const sink = () => ({ setData: vi.fn(), update: vi.fn() });

  it('retries a failed setData on the next identical sync', () => {
    const feeder = createSeriesFeeder();
    const s = sink();
    feeder.set(s, line(4));
    s.setData.mockImplementationOnce(() => {
      throw new Error('setData failed');
    });
    const next = [p(0, 5), ...line(4).slice(1)];
    expect(() => feeder.sync(s, next, 'set')).toThrow('setData failed');
    feeder.sync(s, next, 'set');
    expect(s.setData).toHaveBeenCalledTimes(3);
    expect(s.setData).toHaveBeenLastCalledWith(next);
  });

  it('retries when the setData fallback after a failed update() also throws', () => {
    const feeder = createSeriesFeeder();
    const s = sink();
    feeder.set(s, line(4));
    s.update.mockImplementationOnce(() => {
      throw new Error('update failed');
    });
    s.setData.mockImplementationOnce(() => {
      throw new Error('setData failed');
    });
    const next = line(5);
    expect(() => feeder.sync(s, next, 'append')).toThrow('setData failed');
    feeder.sync(s, next, 'append');
    expect(s.setData).toHaveBeenCalledTimes(3);
    expect(s.setData).toHaveBeenLastCalledWith(next);
  });
});
