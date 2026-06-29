import { describe, it, expect } from 'vitest';
import { toLineData } from './lineChartData';

describe('toLineData', () => {
  it('sorts points ascending by x and maps {x,y} → {time,value}', () => {
    const out = toLineData([
      { x: 3, y: 30 },
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
    expect(out).toEqual([
      { time: 1, value: 10 },
      { time: 2, value: 20 },
      { time: 3, value: 30 },
    ]);
  });

  it('dedupes duplicate x keeping the last value (after sorting)', () => {
    const out = toLineData([
      { x: 1, y: 10 },
      { x: 1, y: 11 },
      { x: 1, y: 12 },
      { x: 2, y: 20 },
    ]);
    expect(out).toEqual([
      { time: 1, value: 12 },
      { time: 2, value: 20 },
    ]);
  });

  it('filters out non-finite y (NaN/Infinity) and non-finite x', () => {
    const out = toLineData([
      { x: 1, y: 10 },
      { x: 2, y: Number.NaN },
      { x: 3, y: Number.POSITIVE_INFINITY },
      { x: Number.NaN, y: 40 },
      { x: 5, y: 50 },
    ]);
    expect(out).toEqual([
      { time: 1, value: 10 },
      { time: 5, value: 50 },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(toLineData([])).toEqual([]);
  });
});
