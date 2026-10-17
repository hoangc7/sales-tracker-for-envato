import { NextResponse } from 'next/server';
import { getDayOfWeekInTimezone, getWeekBoundariesInTimezone } from '@/lib/timezone';
import { calculatePeriodGrowth, parsePeriodOffset, periodCacheHeaders } from '@/lib/sales-periods';
import { itemSummary, loadTrackedItemSales } from '@/lib/period-data';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Week positions in Monday-first order: Monday=1, Tuesday=2, ..., Sunday=0
const MONDAY_BASED_ORDER = [1, 2, 3, 4, 5, 6, 0];

async function getWeeklyAnalyticsData(weeksAgo: number) {
  const now = new Date();
  const currentDay = getDayOfWeekInTimezone(now);

  const week = getWeekBoundariesInTimezone(now, weeksAgo);
  const previousWeek = getWeekBoundariesInTimezone(now, weeksAgo + 1);

  // Target week plus the week before it (for growth), and one baseline record before that.
  const trackedSales = await loadTrackedItemSales(previousWeek.start, week.end);

  // Convert to Monday-based week position: Monday=0, Tuesday=1, ..., Sunday=6
  const currentWeekPosition = currentDay === 0 ? 6 : currentDay - 1;
  // For current week, include Monday through today; for past weeks, all 7 days
  const maxWeekPosition = weeksAgo === 0 ? currentWeekPosition : 6;

  return trackedSales.map((entry) => {
    const salesHistory = entry.records;

    const dailyBreakdown: Array<{ day: number; dayName: string; sales: number }> = [];
    const byDay = new Map<number, { day: number; dayName: string; sales: number }>();
    for (let weekPos = 0; weekPos <= maxWeekPosition; weekPos++) {
      const actualDay = MONDAY_BASED_ORDER[weekPos];
      const dayEntry = { day: actualDay, dayName: DAY_NAMES[actualDay], sales: 0 };
      dailyBreakdown.push(dayEntry);
      byDay.set(actualDay, dayEntry);
    }

    // Calculate daily sales from history - only for the target week
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];

      if (current.scannedAt >= week.start && current.scannedAt <= week.end) {
        const dailySales = Math.max(0, current.salesCount - salesHistory[i + 1].salesCount);
        // Only days included in the breakdown count (for current week, future days are excluded)
        const dayEntry = byDay.get(getDayOfWeekInTimezone(current.scannedAt));
        if (dayEntry) {
          dayEntry.sales += dailySales;
        }
      }
    }

    // Calculate totals and peak day
    const totalWeeklySales = dailyBreakdown.reduce((sum, day) => sum + day.sales, 0);
    const peakDay = dailyBreakdown.reduce((peak, day, index) =>
      day.sales > dailyBreakdown[peak].sales ? index : peak, 0);
    const peakDaySales = dailyBreakdown[peakDay].sales;

    return {
      ...itemSummary(entry),
      dailyBreakdown,
      totalWeeklySales,
      // Day number (0=Sun..6=Sat) of the best day, matching dailyBreakdown[].day
      peakDay: dailyBreakdown[peakDay].day,
      peakDaySales,
      // Versus the previous week (same elapsed span while the week is still in progress)
      growth: calculatePeriodGrowth(salesHistory, week, previousWeek, now),
      weekStart: week.start.toISOString(),
      weekEnd: week.end.toISOString()
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weeksAgo = parsePeriodOffset(searchParams.get('weeksAgo'), 520);

    const weeklyView = await getWeeklyAnalyticsData(weeksAgo);
    return NextResponse.json(weeklyView, { headers: periodCacheHeaders(weeksAgo) });
  } catch (error) {
    console.error('Weekly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly analytics' }, { status: 500 });
  }
}
