import { NextResponse } from 'next/server';
import { getDayBoundariesDaysAgo, getHourInTimezone } from '@/lib/timezone';
import { calculatePeriodGrowth, parsePeriodOffset, periodCacheHeaders } from '@/lib/sales-periods';
import { itemSummary, loadTrackedItemSales } from '@/lib/period-data';

export const dynamic = 'force-dynamic';

async function getDailyAnalyticsData(daysAgo: number) {
  const now = new Date();
  const day = getDayBoundariesDaysAgo(now, daysAgo);
  const previousDay = getDayBoundariesDaysAgo(now, daysAgo + 1);

  // Target day plus the day before it (for growth), and one baseline record before that.
  const trackedSales = await loadTrackedItemSales(previousDay.start, day.end);

  // For today, only include hours up to and including the current hour
  const maxHour = daysAgo === 0 ? getHourInTimezone(now) : 23;

  return trackedSales.map((entry) => {
    const salesHistory = entry.records;

    // Calculate hourly sales from history - include all scanned hours
    const hourlyData = new Map<number, number>();

    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];

      if (current.scannedAt >= day.start && current.scannedAt <= day.end) {
        const hourlySales = Math.max(0, current.salesCount - salesHistory[i + 1].salesCount);
        const hourIndex = getHourInTimezone(current.scannedAt);
        hourlyData.set(hourIndex, (hourlyData.get(hourIndex) || 0) + hourlySales);
      }
    }

    const hourlyBreakdown = [];
    for (let hour = 0; hour <= maxHour; hour++) {
      hourlyBreakdown.push({ hour, sales: hourlyData.get(hour) || 0 });
    }

    // Calculate totals and peak hour
    const totalDailySales = hourlyBreakdown.reduce((sum, hour) => sum + hour.sales, 0);
    const peakHourData = hourlyBreakdown.reduce((peak, hour) =>
      hour.sales > peak.sales ? hour : peak, { hour: 0, sales: 0 });

    return {
      ...itemSummary(entry),
      hourlyBreakdown,
      totalDailySales,
      peakHour: peakHourData.hour,
      peakHourSales: peakHourData.sales,
      // Versus the previous day (same elapsed span while the day is still in progress)
      growth: calculatePeriodGrowth(salesHistory, day, previousDay, now),
      dayStart: day.start.toISOString(),
      dayEnd: day.end.toISOString()
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysAgo = parsePeriodOffset(searchParams.get('daysAgo'));

    const dailyView = await getDailyAnalyticsData(daysAgo);
    return NextResponse.json(dailyView, { headers: periodCacheHeaders(daysAgo) });
  } catch (error) {
    console.error('Daily analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily analytics' }, { status: 500 });
  }
}
