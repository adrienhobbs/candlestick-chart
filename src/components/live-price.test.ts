import { describe, it, expect } from 'vitest';
import { DEFAULT_CHART_THEME } from '../utils/chartTheme';
import { contrastTextColor, countdownText, formatCountdown, livePriceColor, tagHalfHeight } from './live-price';

const live = { price: 101, reference: 100, barCloseAt: 300_000, state: 'live' as const };

describe('formatCountdown', () => {
  it('formats m:ss, flooring and clamping at 0:00', () => {
    expect(formatCountdown(299_500)).toBe('4:59');
    expect(formatCountdown(3_600_000)).toBe('60:00');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5_000)).toBe('0:00');
  });
});

describe('countdownText', () => {
  it('is null without live or on daily', () => {
    expect(countdownText(null, 0)).toBeNull();
    expect(countdownText({ ...live, barCloseAt: null }, 0)).toBeNull();
    expect(countdownText(live, 1_000)).toBe('4:59');
  });

  it('shows 0:00 for an overdue bar or a skewed clock', () => {
    expect(countdownText(live, 400_000)).toBe('0:00');
  });
});

describe('livePriceColor', () => {
  it('uses up/down against the reference, with theme overrides', () => {
    expect(livePriceColor(live, DEFAULT_CHART_THEME)).toBe(DEFAULT_CHART_THEME.upColor);
    expect(livePriceColor({ ...live, price: 100 }, DEFAULT_CHART_THEME)).toBe(DEFAULT_CHART_THEME.upColor);
    expect(livePriceColor({ ...live, price: 99 }, DEFAULT_CHART_THEME)).toBe(DEFAULT_CHART_THEME.downColor);
    expect(livePriceColor(live, { ...DEFAULT_CHART_THEME, livePriceUpColor: '#fff' })).toBe('#fff');
    expect(livePriceColor({ ...live, price: 99 }, { ...DEFAULT_CHART_THEME, livePriceDownColor: '#000' })).toBe('#000');
  });
});

describe('contrastTextColor', () => {
  it('is black on light backgrounds and white on dark ones', () => {
    expect(contrastTextColor('#ffffff')).toBe('#000');
    expect(contrastTextColor('#fff')).toBe('#000');
    expect(contrastTextColor('#fde047')).toBe('#000');
    expect(contrastTextColor('#000000')).toBe('#fff');
    expect(contrastTextColor('#1e40af')).toBe('#fff');
    expect(contrastTextColor('#123456ff')).toBe('#fff');
    expect(contrastTextColor('rgb(255, 255, 255)')).toBe('#000');
    expect(contrastTextColor('rgba(10, 20, 30, 0.5)')).toBe('#fff');
  });

  it('falls back to white for a colour it cannot parse', () => {
    expect(contrastTextColor('tomato')).toBe('#fff');
    expect(contrastTextColor('#12')).toBe('#fff');
  });
});

describe('tagHalfHeight', () => {
  it('scales with the axis font size, with a fallback', () => {
    expect(tagHalfHeight(12)).toBe(9);
    expect(tagHalfHeight(16)).toBe(12);
    expect(tagHalfHeight(undefined)).toBe(9);
    expect(tagHalfHeight(0)).toBe(9);
  });
});
