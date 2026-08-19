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

export function getDatePartsInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year')!.value),
    month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
    day: parseInt(parts.find(p => p.type === 'day')!.value),
  };
}

export function getDayBoundariesInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const { year, month, day } = getDatePartsInTimezone(date, timeZone);

  const utcMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const melbTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(utcMidnight);

  const melbHour = parseInt(melbTime.find(p => p.type === 'hour')!.value);
  const melbMin = parseInt(melbTime.find(p => p.type === 'minute')!.value);

  const dayStart = new Date(utcMidnight.getTime() - (melbHour * 3600000 + melbMin * 60000));
  const dayEnd = new Date(dayStart.getTime() + 86399999);

  return { start: dayStart, end: dayEnd };
}

export function getHourInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date)
  );
}

export function getDayOfWeekInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getDayOfMonthInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date);
  return parseInt(dateStr.split('-')[2]);
}

export function formatDateKeyInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
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
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(value);
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
