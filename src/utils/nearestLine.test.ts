import { describe, it, expect } from 'vitest';
import { nearestLineWithin } from './nearestLine';
import { ChartLine } from '../types/chart';

const line = (id: string, price: number, extra: Partial<ChartLine> = {}): ChartLine => ({
  id,
  price,
  color: '#fff',
  ...extra,
});

// Map price → y as y = price (identity) so the hit math is easy to reason about.
const identity = (price: number) => price;

describe('nearestLineWithin', () => {
  it('returns the line within the hit radius', () => {
    const lines = [line('a', 100), line('b', 200)];
    expect(nearestLineWithin(103, lines, identity, 6)).toBe('a');
  });

  it('returns null when nothing is within the hit radius', () => {
    const lines = [line('a', 100), line('b', 200)];
    expect(nearestLineWithin(150, lines, identity, 6)).toBeNull();
  });

  it('picks the closest line when two are in range', () => {
    const lines = [line('a', 100), line('b', 105)];
    expect(nearestLineWithin(104, lines, identity, 6)).toBe('b');
  });

  it('includes lines exactly at the threshold distance', () => {
    const lines = [line('a', 100)];
    expect(nearestLineWithin(106, lines, identity, 6)).toBe('a');
    expect(nearestLineWithin(107, lines, identity, 6)).toBeNull();
  });

  it('skips lines whose price cannot be projected (null coordinate)', () => {
    const lines = [line('off', 100), line('on', 200)];
    const project = (price: number) => (price === 100 ? null : price);
    // 'off' projects to null even though mouseY is right on it → skipped.
    expect(nearestLineWithin(100, lines, project, 6)).toBeNull();
    expect(nearestLineWithin(201, lines, project, 6)).toBe('on');
  });

  it('returns null for an empty candidate list', () => {
    expect(nearestLineWithin(100, [], identity, 6)).toBeNull();
  });
});
