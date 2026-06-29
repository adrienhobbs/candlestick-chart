import { describe, it, expect, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartAPI } from './useChartAPI';
import { indicatorRegistry } from '../indicators/core/registry';
import { registerBuiltInIndicators } from '../indicators/registry';
import { NoOpPersistenceAdapter } from '../indicators/core/persistence';
import type { IndicatorInstance } from '../indicators/core/types';

describe('useChartAPI', () => {
  beforeAll(() => {
    indicatorRegistry.clear();
    registerBuiltInIndicators();
  });

  const render = () =>
    renderHook(() => useChartAPI({ persistenceAdapter: new NoOpPersistenceAdapter() }));

  it('adds and removes a line', () => {
    const { result } = render();
    expect(result.current.lines).toHaveLength(0);

    act(() => result.current.addLine('line-1', 123.45, { color: '#fff' }));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toMatchObject({ id: 'line-1', price: 123.45, color: '#fff' });

    act(() => result.current.removeLine('line-1'));
    expect(result.current.lines).toHaveLength(0);
  });

  it('adds and removes an indicator', () => {
    const { result } = render();
    expect(result.current.indicators).toHaveLength(0);

    let inst: IndicatorInstance | undefined;
    act(() => {
      inst = result.current.addIndicator('sma');
    });
    expect(inst).toBeDefined();
    expect(inst!.definitionId).toBe('sma');
    expect(result.current.indicators).toHaveLength(1);

    act(() => result.current.removeIndicator(inst!.id));
    expect(result.current.indicators).toHaveLength(0);
  });
});
