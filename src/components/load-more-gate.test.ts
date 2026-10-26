import { describe, it, expect } from 'vitest';
import { createLoadMoreGate } from './load-more-gate';

describe('createLoadMoreGate', () => {
  it('requests at the left edge, once, until the load ends', () => {
    const gate = createLoadMoreGate();
    gate.onBars(1000);
    expect(gate.onRange(10, 1000)).toBeNull();
    expect(gate.onRange(2, 1000)).toBe(1000);
    expect(gate.loading).toBe(true);
    expect(gate.onRange(1, 1000)).toBeNull();
  });

  it('ends the load when older bars arrive, and asks again at the edge', () => {
    const gate = createLoadMoreGate();
    gate.onBars(1000);
    gate.onRange(0, 1000);
    expect(gate.onBars(500)).toBe(true);
    expect(gate.loading).toBe(false);
    // Fully zoomed out: the view never leaves the edge, but the growth re-arms it.
    expect(gate.onRange(0, 500)).toBe(500);
  });

  it('a bar appended on the right does not end the load', () => {
    const gate = createLoadMoreGate();
    gate.onBars(1000);
    gate.onRange(0, 1000);
    expect(gate.onBars(1000)).toBe(false);
    expect(gate.loading).toBe(true);
  });

  it('an empty load settles without re-requesting until the view leaves the edge', () => {
    const gate = createLoadMoreGate();
    gate.onBars(1000);
    gate.onRange(0, 1000);
    expect(gate.onSettled()).toBe(true);
    expect(gate.loading).toBe(false);
    expect(gate.onRange(0, 1000)).toBeNull();
    gate.onRange(20, 1000);
    expect(gate.onRange(3, 1000)).toBe(1000);
  });

  it('older bars landing after the settle re-arm the edge', () => {
    const gate = createLoadMoreGate();
    gate.onBars(1000);
    gate.onRange(0, 1000);
    gate.onSettled();
    expect(gate.onBars(400)).toBe(false);
    expect(gate.onRange(0, 400)).toBe(400);
  });

  it('does not request with no bars, and settling when idle is a no-op', () => {
    const gate = createLoadMoreGate();
    expect(gate.onRange(0, undefined)).toBeNull();
    expect(gate.onSettled()).toBe(false);
  });
});
