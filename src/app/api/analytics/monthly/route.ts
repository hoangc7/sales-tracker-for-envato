import { NextResponse } from 'next/server';
import { getDayOfMonthInTimezone, getDaysInMonthOf, getMonthBoundariesInTimezone } from '@/lib/timezone';
import { calculatePeriodGrowth, parsePeriodOffset, periodCacheHeaders } from '@/lib/sales-periods';
import { itemSummary, loadTrackedItemSales } from '@/lib/period-data';

export const dynamic = 'force-dynamic';

async function getMonthlyAnalyticsData(monthsAgo: number) {
  const now = new Date();
  // Boundaries resolve in the tracking timezone; the local-time Date constructor would
  // follow the process clock, which is Melbourne locally but UTC on Vercel.
  const month = getMonthBoundariesInTimezone(now, monthsAgo);
  const previousMonth = getMonthBoundariesInTimezone(now, monthsAgo + 1);

  // Days in the target month, resolved in the tracking timezone
  const daysInMonth = getDaysInMonthOf(month.start);

  // Target month plus the month before it (for growth), and one baseline record before that.
  const trackedSales = await loadTrackedItemSales(previousMonth.start, month.end);

  return trackedSales.map((entry) => {
    const salesHistory = entry.records;

    // Initialize daily breakdown for the month (1-based day numbers)
    const dailyBreakdown = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      sales: 0
    }));

    // Calculate daily sales from history - only for the target month
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];

      if (current.scannedAt >= month.start && current.scannedAt <= month.end) {
        const dailySales = Math.max(0, current.salesCount - salesHistory[i + 1].salesCount);
        const dayOfMonth = getDayOfMonthInTimezone(current.scannedAt);
        if (dayOfMonth >= 1 && dayOfMonth <= daysInMonth) {
          dailyBreakdown[dayOfMonth - 1].sales += dailySales;
        }
      }
    }

    // Calculate totals and peak day
    const totalMonthlySales = dailyBreakdown.reduce((sum, day) => sum + day.sales, 0);
    const peakDay = dailyBreakdown.reduce((peak, day, index) =>
      day.sales > dailyBreakdown[peak].sales ? index : peak, 0);
    const peakDaySales = dailyBreakdown[peakDay].sales;

    return {
      ...itemSummary(entry),
      dailyBreakdown,
      totalMonthlySales,
      peakDay: peakDay + 1, // Convert back to 1-based day
      peakDaySales,
      // Versus the previous month (same elapsed span while the month is still in progress)
      growth: calculatePeriodGrowth(salesHistory, month, previousMonth, now),
      monthStart: month.start.toISOString(),
      monthEnd: month.end.toISOString()
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsAgo = parsePeriodOffset(searchParams.get('monthsAgo'), 120);

    const monthlyView = await getMonthlyAnalyticsData(monthsAgo);
    return NextResponse.json(monthlyView, { headers: periodCacheHeaders(monthsAgo) });
  } catch (error) {
    console.error('Monthly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly analytics' }, { status: 500 });
  }
}
