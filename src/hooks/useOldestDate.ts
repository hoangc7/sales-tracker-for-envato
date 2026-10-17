import { useCachedAPI } from './useCachedAPI';
import {
  getDayBoundariesDaysAgo,
  getMonthBoundariesInTimezone,
  getWeekBoundariesInTimezone,
} from '@/lib/timezone';

interface DataRangeResponse {
  type: 'oldest' | 'newest';
  oldestDate?: string | null;
  newestDate?: string | null;
  cached: boolean;
}

/**
 * Navigation bounds from the oldest scan. A previous period is reachable when it ends on
 * or after the oldest scan, i.e. it holds at least some data. Boundaries come from
 * `lib/timezone.ts` so they match the analytics routes regardless of the viewer's clock.
 */
export function useOldestDate() {
  const { data, loading, error } = useCachedAPI<DataRangeResponse>(
    '/api/analytics/data-range?type=oldest'
  );

  const oldestDate = data?.oldestDate ? new Date(data.oldestDate) : null;

  // If we don't know the oldest date yet, allow navigation
  const reachable = (periodEnd: Date) => !oldestDate || periodEnd >= oldestDate;

  const canGoToPreviousDay = (daysAgo: number): boolean =>
    reachable(getDayBoundariesDaysAgo(new Date(), daysAgo + 1).end);

  const canGoToPreviousWeek = (weeksAgo: number): boolean =>
    reachable(getWeekBoundariesInTimezone(new Date(), weeksAgo + 1).end);

  const canGoToPreviousMonth = (monthsAgo: number): boolean =>
    reachable(getMonthBoundariesInTimezone(new Date(), monthsAgo + 1).end);

  return {
    oldestDate,
    loading,
    error,
    canGoToPreviousWeek,
    canGoToPreviousDay,
    canGoToPreviousMonth,
  };
}
