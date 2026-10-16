/**
 * Timezone that defines period boundaries — which calendar day, week or month a scan
 * belongs to. Every aggregation and every period *label* must use this one.
 */
export const DEFAULT_TIMEZONE = 'Australia/Melbourne';

/**
 * Timezone used to render an instant (e.g. "last scanned at"). Distinct from
 * DEFAULT_TIMEZONE on purpose: boundaries are Melbourne, wall-clock readouts are GMT+7.
 * Never use this to label a day/week/month — that would shift the label off its bucket.
 */
export const DISPLAY_TIMEZONE = 'Asia/Bangkok';

// Constructing an Intl.DateTimeFormat is far more expensive than calling format() on one,
// and the analytics routes format every scan record, so formatters are built once per
// (locale, options, timezone) and reused.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function getDatePartsInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE) {
  // en-CA formats as YYYY-MM-DD, which is cheaper to split than formatToParts().
  const [year, month, day] = formatDateKeyInTimezone(date, timeZone).split('-').map(Number);
  return { year, month: month - 1, day };
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds (Melbourne: +10h/+11h). */
function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getFormatter('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant of local midnight on the given calendar day in `timeZone`. */
function getLocalMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const utcMidnight = Date.UTC(year, month, day);
  // Resolve twice: the offset at UTC midnight can differ from the offset at local midnight
  // on DST transition days.
  const guess = utcMidnight - getTimezoneOffsetMs(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - getTimezoneOffsetMs(new Date(guess), timeZone));
}

export function getDayBoundariesInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const { year, month, day } = getDatePartsInTimezone(date, timeZone);

  const dayStart = getLocalMidnight(year, month, day, timeZone);
  // Next local midnight minus 1ms, so 23h/25h DST days get their real length.
  const dayEnd = new Date(getLocalMidnight(year, month, day + 1, timeZone).getTime() - 1);

  return { start: dayStart, end: dayEnd };
}

export function getHourInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  // hourCycle 'h23' guarantees 0-23; hour12: false yields "24" for midnight on some ICU builds,
  // which the daily route would then drop as out of range.
  return parseInt(
    getFormatter('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date)
  ) % 24;
}

export function getDayOfWeekInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const { year, month, day } = getDatePartsInTimezone(date, timeZone);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

export function getDayOfMonthInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  return getDatePartsInTimezone(date, timeZone).day;
}

export function formatDateKeyInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return getFormatter('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Shift a date by whole days while staying anchored to the target timezone's calendar.
 * Lands at midday of the shifted day so DST transitions can never spill into a neighbouring day.
 */
export function shiftDaysInTimezone(date: Date, days: number, timeZone: string = DEFAULT_TIMEZONE): Date {
  const { start } = getDayBoundariesInTimezone(date, timeZone);
  return new Date(start.getTime() + days * 86400000 + 12 * 3600000);
}

/**
 * Monday 00:00 → Sunday 23:59:59.999 boundaries of the calendar week containing `date`,
 * in the target timezone. `weeksAgo` walks back whole weeks.
 */
export function getWeekBoundariesInTimezone(
  date: Date,
  weeksAgo: number = 0,
  timeZone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  const dayOfWeek = getDayOfWeekInTimezone(date, timeZone);
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = shiftDaysInTimezone(date, -(daysToMonday + weeksAgo * 7), timeZone);
  const sunday = shiftDaysInTimezone(monday, 6, timeZone);

  return {
    start: getDayBoundariesInTimezone(monday, timeZone).start,
    end: getDayBoundariesInTimezone(sunday, timeZone).end,
  };
}

/**
 * Format a date in an explicit timezone. Safe to call from client components: without a
 * timeZone, `toLocaleDateString` follows the *viewer's* clock, which shifts a Melbourne
 * period boundary (e.g. Monday 00:00 = Sunday 14:00 UTC) onto the wrong calendar day.
 *
 * Use DEFAULT_TIMEZONE (the default) for period labels; DISPLAY_TIMEZONE for instants.
 */
export function formatInTimezone(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return getFormatter('en-US', { ...options, timeZone }).format(value);
}

/** Render an instant (not a period boundary) in the display timezone. */
export function formatTimestamp(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
): string {
  return formatInTimezone(date, options, DISPLAY_TIMEZONE);
}

/** 0-based month index of `date` in the target timezone. */
export function getMonthInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  return getDatePartsInTimezone(date, timeZone).month;
}

/** Number of days in the calendar month that `date` falls in, resolved in the target timezone. */
export function getDaysInMonthOf(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const { year, month } = getDatePartsInTimezone(date, timeZone);
  // Day 0 of the next month is the last day of this one; built in UTC so the process
  // clock cannot shift it.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Start/end of the calendar month `monthsAgo` months before the one containing `date`,
 * in the target timezone.
 */
export function getMonthBoundariesInTimezone(
  date: Date,
  monthsAgo: number = 0,
  timeZone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  const { year, month } = getDatePartsInTimezone(date, timeZone);
  // Midday UTC anchors, built in UTC so the process clock cannot shift them, then snapped
  // to the timezone's day boundaries. Date.UTC normalises negative/overflowing months.
  const firstDay = new Date(Date.UTC(year, month - monthsAgo, 1, 12));
  const lastDay = new Date(Date.UTC(year, month - monthsAgo + 1, 0, 12));

  return {
    start: getDayBoundariesInTimezone(firstDay, timeZone).start,
    end: getDayBoundariesInTimezone(lastDay, timeZone).end,
  };
}

/** Day boundaries of the calendar day `daysAgo` days before the one containing `date`. */
export function getDayBoundariesDaysAgo(
  date: Date,
  daysAgo: number = 0,
  timeZone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  return getDayBoundariesInTimezone(shiftDaysInTimezone(date, -daysAgo, timeZone), timeZone);
}
