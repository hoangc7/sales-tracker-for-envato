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
