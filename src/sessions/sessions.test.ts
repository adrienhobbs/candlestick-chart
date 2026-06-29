import { describe, it, expect } from 'vitest';
import {
  US_EQUITY_PRESET,
  etDateFields,
  classifySession,
  buildSessionRuns,
  detectDayBoundaries,
  type SessionsConfig,
} from './sessions';

const TZ = 'America/New_York';
const cfg: SessionsConfig = US_EQUITY_PRESET;

// Build an epoch-ms timestamp from a UTC wall-clock time. The ET wall-clock is then
// derived via the known offset (EST = UTC-5 in winter, EDT = UTC-4 in summer).
const utc = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo, d, h, mi, 0, 0);

describe('etDateFields', () => {
  it('derives ET minutes-of-day + dayKey (winter / EST = UTC-5)', () => {
    // 2024-01-08 08:00 ET = 13:00 UTC
    expect(etDateFields(utc(2024, 0, 8, 13, 0), TZ)).toEqual({ minutesOfDay: 480, dayKey: '2024-01-08' });
    // 10:00 ET = 15:00 UTC
    expect(etDateFields(utc(2024, 0, 8, 15, 0), TZ).minutesOfDay).toBe(600);
    // 17:00 ET = 22:00 UTC
    expect(etDateFields(utc(2024, 0, 8, 22, 0), TZ).minutesOfDay).toBe(1020);
  });

  it('handles DST (summer / EDT = UTC-4) correctly', () => {
    // 2024-07-15 10:00 EDT = 14:00 UTC → still 600 minutes (wall-clock), not shifted by the offset
    expect(etDateFields(utc(2024, 6, 15, 14, 0), TZ)).toEqual({ minutesOfDay: 600, dayKey: '2024-07-15' });
    // 2024-03-10 (spring-forward day) 10:00 EDT = 14:00 UTC
    expect(etDateFields(utc(2024, 2, 10, 14, 0), TZ).minutesOfDay).toBe(600);
  });
});

describe('classifySession (US preset)', () => {
  const s = cfg.sessions;
  it('maps minutes-of-day to the right session, boundaries inclusive-start/exclusive-end', () => {
    expect(classifySession(480, s)).toBe(0); // 08:00 pre-market
    expect(classifySession(240, s)).toBe(0); // 04:00 start inclusive
    expect(classifySession(570, s)).toBe(1); // 09:30 → RTH (pre end exclusive)
    expect(classifySession(600, s)).toBe(1); // 10:00 RTH
    expect(classifySession(960, s)).toBe(2); // 16:00 → after-hours (RTH end exclusive)
    expect(classifySession(1020, s)).toBe(2); // 17:00 after-hours
    expect(classifySession(1200, s)).toBe(-1); // 20:00 end exclusive → outside
    expect(classifySession(120, s)).toBe(-1); // 02:00 overnight → outside
  });
});

describe('buildSessionRuns', () => {
  it('groups consecutive bars into pre → RTH → after-hours runs', () => {
    const times = [
      utc(2024, 0, 8, 13, 0), // 08:00 pre
      utc(2024, 0, 8, 13, 30), // 08:30 pre
      utc(2024, 0, 8, 15, 0), // 10:00 RTH
      utc(2024, 0, 8, 16, 0), // 11:00 RTH
      utc(2024, 0, 8, 22, 0), // 17:00 AH
    ];
    expect(buildSessionRuns(times, cfg)).toEqual([
      { startIdx: 0, endIdx: 1, sessionIndex: 0 },
      { startIdx: 2, endIdx: 3, sessionIndex: 1 },
      { startIdx: 4, endIdx: 4, sessionIndex: 2 },
    ]);
  });

  it('marks overnight bars as -1 (outside all sessions)', () => {
    const times = [utc(2024, 0, 8, 7, 0) /* 02:00 ET */, utc(2024, 0, 8, 15, 0) /* 10:00 ET */];
    const runs = buildSessionRuns(times, cfg);
    expect(runs[0].sessionIndex).toBe(-1);
    expect(runs[1].sessionIndex).toBe(1);
  });
});

describe('detectDayBoundaries', () => {
  it('returns the index of the first bar of each new ET day', () => {
    const times = [
      utc(2024, 0, 8, 15, 0), // Jan 8 10:00
      utc(2024, 0, 8, 16, 0), // Jan 8 11:00
      utc(2024, 0, 9, 15, 0), // Jan 9 10:00  ← new day
      utc(2024, 0, 9, 16, 0), // Jan 9 11:00
      utc(2024, 0, 10, 15, 0), // Jan 10 10:00 ← new day
    ];
    expect(detectDayBoundaries(times, cfg)).toEqual([2, 4]);
  });

  it('returns empty for a single day (no internal boundary, index 0 excluded)', () => {
    const times = [utc(2024, 0, 8, 15, 0), utc(2024, 0, 8, 16, 0)];
    expect(detectDayBoundaries(times, cfg)).toEqual([]);
  });
});
