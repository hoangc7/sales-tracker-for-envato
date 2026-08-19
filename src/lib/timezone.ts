export const DEFAULT_TIMEZONE = 'Australia/Melbourne';

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
