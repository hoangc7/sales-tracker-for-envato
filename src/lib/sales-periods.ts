import {
  DEFAULT_TIMEZONE,
  formatDateKeyInTimezone,
  getDayBoundariesInTimezone,
  shiftDaysInTimezone,
} from './timezone';

/**
 * Shared aggregation helpers for turning cumulative sales snapshots into per-period
 * sales. Used by the Overview (`/api/items`) and the analytics routes so every tab
 * derives its numbers from exactly the same rules.
 *
 * Records are expected newest-first, as returned by `getBatchSalesHistory` /
 * `getSalesHistory`. Each scan's delta (`record[i] - record[i + 1]`) is attributed to
 * `record[i].scannedAt`; negative deltas are clamped to 0.
 */
export interface SalesRecordLike {
  salesCount: number;
  scannedAt: Date;
}

export interface DailySalesTotal {
  /** Calendar day in the display timezone, `YYYY-MM-DD`. */
  date: string;
  /** Start-of-day instant for that calendar day, ISO 8601. */
  dayStart: string;
  dailySales: number;
  /** Highest cumulative total recorded on that day. */
  totalSales: number;
}

/** Sum of the per-scan deltas whose scan timestamp falls inside [start, end]. */
export function sumSalesInRange(
  records: SalesRecordLike[],
  start: Date,
  end: Date
): number {
  let total = 0;

  for (let i = 0; i < records.length - 1; i++) {
    const current = records[i];
    if (current.scannedAt >= start && current.scannedAt <= end) {
      total += Math.max(0, current.salesCount - records[i + 1].salesCount);
    }
  }

  return total;
}

/**
 * Per-calendar-day sales totals for the last `days` days (today first), grouped by the
 * display timezone rather than by scan interval. Days with no scan data are omitted so
 * a gap in scanning is not reported as a zero-sales day.
 */
export function getDailySalesTotals(
  records: SalesRecordLike[],
  days: number,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): DailySalesTotal[] {
  if (records.length < 2) return [];

  const buckets = new Map<string, DailySalesTotal & { scanned: boolean }>();

  for (let offset = 0; offset < days; offset++) {
    const day = shiftDaysInTimezone(now, -offset, timeZone);
    const key = formatDateKeyInTimezone(day, timeZone);
    buckets.set(key, {
      date: key,
      dayStart: getDayBoundariesInTimezone(day, timeZone).start.toISOString(),
      dailySales: 0,
      totalSales: 0,
      scanned: false,
    });
  }

  for (let i = 0; i < records.length - 1; i++) {
    const current = records[i];
    const bucket = buckets.get(formatDateKeyInTimezone(current.scannedAt, timeZone));
    if (!bucket) continue;

    bucket.scanned = true;
    bucket.dailySales += Math.max(0, current.salesCount - records[i + 1].salesCount);
    bucket.totalSales = Math.max(bucket.totalSales, current.salesCount);
  }

  return Array.from(buckets.values())
    .filter(bucket => bucket.scanned)
    .map(bucket => ({
      date: bucket.date,
      dayStart: bucket.dayStart,
      dailySales: bucket.dailySales,
      totalSales: bucket.totalSales,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
