import { useState, useEffect } from 'react';

interface DataRangeResponse {
  type: 'oldest' | 'newest';
  oldestDate?: string | null;
  newestDate?: string | null;
  cached: boolean;
}

export function useOldestDate() {
  const [oldestDate, setOldestDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOldestDate = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/analytics/data-range?type=oldest');
        if (!response.ok) {
          throw new Error('Failed to fetch data range');
        }

        const data: DataRangeResponse = await response.json();

        if (data.oldestDate) {
          setOldestDate(new Date(data.oldestDate));
        } else {
          setOldestDate(null);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setOldestDate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOldestDate();
  }, []);

  // Helper functions to check if we can go back further
  const canGoToPreviousWeek = (weeksAgo: number): boolean => {
    if (!oldestDate) return true; // If we don't know, allow navigation

    const now = new Date();
    const currentDay = now.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;

    // Calculate Monday of the week we would navigate to
    const targetMonday = new Date(now);
    targetMonday.setDate(now.getDate() - daysToMonday - ((weeksAgo + 1) * 7));
    targetMonday.setHours(0, 0, 0, 0);

    return targetMonday >= oldestDate;
  };

  const canGoToPreviousDay = (daysAgo: number): boolean => {
    if (!oldestDate) return true; // If we don't know, allow navigation

    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - (daysAgo + 1));
    targetDate.setHours(0, 0, 0, 0);

    return targetDate >= oldestDate;
  };

  const canGoToPreviousMonth = (monthsAgo: number): boolean => {
    if (!oldestDate) return true; // If we don't know, allow navigation

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - (monthsAgo + 1), 1);

    return targetDate >= oldestDate;
  };

  return {
    oldestDate,
    loading,
    error,
    canGoToPreviousWeek,
    canGoToPreviousDay,
    canGoToPreviousMonth,
  };
}
