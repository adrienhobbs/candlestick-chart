// Pure session-classification logic for the chart's session-shading primitive.
// No canvas, no chart — all functions are deterministic given an explicit timeZone,
// so they're unit-testable. The primitive (SessionsPrimitive) consumes these and adds
// the canvas drawing.

/** One trading session, as minutes-of-day in the config's timeZone. */
export interface SessionDef {
  /** Display name (e.g. "pre-market"). */
  name: string;
  /** Inclusive start, minutes from local midnight (e.g. 09:30 = 570). */
  startMinutes: number;
  /** Exclusive end, minutes from local midnight (e.g. 16:00 = 960). */
  endMinutes: number;
  /** Fill color for the session region. Use `"transparent"` for no shading (e.g. RTH). */
  color: string;
}

export interface SessionsConfig {
  /** IANA timezone the session boundaries are defined in (e.g. "America/New_York"). */
  timeZone: string;
  /** Sessions to shade; non-overlapping, ordered. Bars outside all sessions are unshaded. */
  sessions: SessionDef[];
  /** Vertical day-separator line color. Omit/empty to hide separators. */
  separatorColor?: string;
  /** Day-separator line width in CSS px (default 1). */
  separatorWidthPx?: number;
}

/** US-equity sessions in ET: pre-market + after-hours dimmed, RTH unshaded. */
export const US_EQUITY_PRESET: SessionsConfig = {
  timeZone: 'America/New_York',
  sessions: [
    { name: 'pre-market', startMinutes: 240, endMinutes: 570, color: 'rgba(128,128,128,0.10)' }, // 04:00–09:30
    { name: 'regular', startMinutes: 570, endMinutes: 960, color: 'transparent' }, //              09:30–16:00
    { name: 'after-hours', startMinutes: 960, endMinutes: 1200, color: 'rgba(128,128,128,0.10)' }, // 16:00–20:00
  ],
  separatorColor: 'rgba(128,128,128,0.25)',
  separatorWidthPx: 1,
};

// One Intl formatter per timeZone (formatToParts is the hot cost on data change).
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/**
 * Wall-clock fields of `tsMs` in `timeZone`, derived in one `formatToParts` pass:
 * `minutesOfDay` (0–1439) and `dayKey` ("YYYY-MM-DD"). DST is handled automatically
 * because Intl returns local wall-clock fields.
 */
export function etDateFields(tsMs: number, timeZone: string): { minutesOfDay: number; dayKey: string } {
  const parts = getFormatter(timeZone).formatToParts(new Date(tsMs));
  let year = '';
  let month = '';
  let day = '';
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    switch (p.type) {
      case 'year':
        year = p.value;
        break;
      case 'month':
        month = p.value;
        break;
      case 'day':
        day = p.value;
        break;
      case 'hour':
        hour = parseInt(p.value, 10);
        break;
      case 'minute':
        minute = parseInt(p.value, 10);
        break;
    }
  }
  // Some ICU builds emit hour "24" for local midnight under h23; normalize to 0.
  if (hour === 24) hour = 0;
  return { minutesOfDay: hour * 60 + minute, dayKey: `${year}-${month}-${day}` };
}

/** Index of the session containing `minutesOfDay`, or -1 if outside all sessions. */
export function classifySession(minutesOfDay: number, sessions: SessionDef[]): number {
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (minutesOfDay >= s.startMinutes && minutesOfDay < s.endMinutes) return i;
  }
  return -1;
}

/** A maximal run of consecutive bars sharing one session (or -1 = none). */
export interface SessionRun {
  startIdx: number;
  endIdx: number;
  sessionIndex: number;
}

/**
 * Group consecutive bars (ascending `timesMs`) into runs of the same session. Runs with
 * `sessionIndex === -1` (outside all sessions) are included; the renderer skips those and
 * any whose session color is `"transparent"`.
 */
export function buildSessionRuns(timesMs: number[], config: SessionsConfig): SessionRun[] {
  const runs: SessionRun[] = [];
  let cur: SessionRun | null = null;
  for (let i = 0; i < timesMs.length; i++) {
    const { minutesOfDay } = etDateFields(timesMs[i], config.timeZone);
    const sessionIndex = classifySession(minutesOfDay, config.sessions);
    if (cur && cur.sessionIndex === sessionIndex) {
      cur.endIdx = i;
    } else {
      if (cur) runs.push(cur);
      cur = { startIdx: i, endIdx: i, sessionIndex };
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

/** Indices of the first bar of each new calendar day (in `config.timeZone`), excluding index 0. */
export function detectDayBoundaries(timesMs: number[], config: SessionsConfig): number[] {
  const out: number[] = [];
  let prevDay: string | null = null;
  for (let i = 0; i < timesMs.length; i++) {
    const { dayKey } = etDateFields(timesMs[i], config.timeZone);
    if (prevDay !== null && dayKey !== prevDay) out.push(i);
    prevDay = dayKey;
  }
  return out;
}
