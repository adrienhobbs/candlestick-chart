import { describe, it, expect } from 'vitest';
import { clampOverlayX } from './overlay-geometry';

// Identity projection within [0,100]; off-range times return null (off-screen).
const project = (t: number): number | null => (t >= 0 && t <= 100 ? t : null);

describe('clampOverlayX', () => {
  it('returns null when the span is entirely left of the visible range', () => {
    expect(clampOverlayX(-50, -10, 0, 100, 100, project)).toBeNull();
  });

  it('returns null when the span is entirely right of the visible range', () => {
    expect(clampOverlayX(110, 150, 0, 100, 100, project)).toBeNull();
  });

  it('projects a fully-visible span directly', () => {
    expect(clampOverlayX(20, 60, 0, 100, 100, project)).toEqual([20, 60]);
  });

  it('clamps an off-left start to 0', () => {
    // start -10 is before vFrom (0) → x1 clamps to 0; end 40 resolves.
    expect(clampOverlayX(-10, 40, 0, 100, 100, project)).toEqual([0, 40]);
  });

  it('clamps an off-right end to width', () => {
    expect(clampOverlayX(70, 130, 0, 100, 100, project)).toEqual([70, 100]);
  });

  it('clamps a span straddling the whole view to [0, width]', () => {
    expect(clampOverlayX(-20, 200, 0, 100, 100, project)).toEqual([0, 100]);
  });
});
