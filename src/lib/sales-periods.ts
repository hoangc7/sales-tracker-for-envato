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
 * Records are expected newest-first, as returned by `getSalesRecordsInRange` /
 * `getBatchSalesHistory`. Each scan's delta (`record[i] - record[i + 1]`) is attributed to
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

export interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * Percentage change of sales in `current` versus `previous`.
 *
 * When `current` is still in progress, only the same elapsed span of `previous` is
 * counted (e.g. today until 14:00 vs. yesterday until 14:00), so a partial period is
 * never compared against a full one. Returns 0 when there is no previous baseline.
 */
export function calculatePeriodGrowth(
  records: SalesRecordLike[],
  current: PeriodRange,
  previous: PeriodRange,
  now: Date = new Date()
): number {
  const currentEnd = now < current.end ? now : current.end;
  if (currentEnd < current.start) return 0;

  const elapsed = currentEnd.getTime() - current.start.getTime();
  const previousEnd = new Date(Math.min(previous.end.getTime(), previous.start.getTime() + elapsed));

  const currentSales = sumSalesInRange(records, current.start, currentEnd);
  const previousSales = sumSalesInRange(records, previous.start, previousEnd);

  return previousSales > 0 ? ((currentSales - previousSales) / previousSales) * 100 : 0;
}

/** Parse a `daysAgo` / `weeksAgo` / `monthsAgo` query param into a safe, non-negative integer. */
export function parsePeriodOffset(value: string | null, max: number = 3650): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, max);
}

/**
 * Cache-Control for an analytics response. A finished period can no longer change (each
 * scan's delta is attributed to the scan time), so the CDN may serve it for a while;
 * the current period changes with every scan and is never cached.
 */
export function periodCacheHeaders(offset: number): HeadersInit {
  return offset > 0
    ? { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' }
    : { 'Cache-Control': 'no-store' };
}
