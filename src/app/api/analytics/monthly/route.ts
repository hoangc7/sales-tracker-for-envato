import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, CACHE_REVALIDATION } from '@/lib/cache';

async function getMonthlyAnalyticsData(monthsAgo: number) {
  // Calculate the start and end of the target month
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);

  const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const db = new DatabaseService();
  const allItems = await db.getAllItems();

  // Filter items to only show those in current config
  const configUrls = TRACKED_ITEMS.map(item => item.url);
  const items = allItems.filter(item => configUrls.includes(item.url));

  // OPTIMIZATION: Fetch all sales history in one query instead of N queries
  const itemIds = items.map(item => item.id);
  const batchSalesHistory = await db.getBatchSalesHistory(itemIds, 90);

  // Generate daily breakdown data for each item (days of the month)
  const monthlyView = items.map((item) => {
    // Get sales history for this item from the batch result
    const salesHistory = batchSalesHistory.get(item.id) || [];

    // Get number of days in the target month
    const daysInMonth = monthEnd.getDate();

    // Initialize daily breakdown for the month (1-based day numbers)
    const dailyBreakdown = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      sales: 0
    }));

    // Calculate daily sales from history - only for the target month
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];
      const previous = salesHistory[i + 1];

      // Check if this record is within our target month
      if (current.scannedAt >= monthStart && current.scannedAt <= monthEnd) {
        const dailySales = Math.max(0, current.salesCount - previous.salesCount);

        // Get day of month (1-based)
        const dayOfMonth = current.scannedAt.getDate();
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

    // Calculate growth (simple comparison of recent vs previous periods)
    const recentSales = salesHistory.slice(0, Math.floor(salesHistory.length / 2))
      .reduce((sum, record, index) => {
        if (index < salesHistory.length / 2 - 1) {
          return sum + Math.max(0, record.salesCount - salesHistory[index + 1].salesCount);
        }
        return sum;
      }, 0);

    const previousSales = salesHistory.slice(Math.floor(salesHistory.length / 2))
      .reduce((sum, record, index) => {
        if (index < salesHistory.length / 2 - 1) {
          const nextIndex = Math.floor(salesHistory.length / 2) + index + 1;
          if (nextIndex < salesHistory.length) {
            return sum + Math.max(0, record.salesCount - salesHistory[nextIndex].salesCount);
          }
        }
        return sum;
      }, 0);

    const growth = previousSales > 0 ? ((recentSales - previousSales) / previousSales) * 100 : 0;

    return {
      id: item.id,
      name: item.name,
      url: item.url,
      envatoId: item.envatoId,
      author: item.author || undefined,
      category: item.category || undefined,
      latestSales: salesHistory[0]?.salesCount || 0,
      latestPrice: salesHistory[0]?.price || undefined,
      lastScanned: salesHistory[0]?.scannedAt?.toISOString(),
      dailyBreakdown,
      totalMonthlySales,
      peakDay: peakDay + 1, // Convert back to 1-based day
      peakDaySales,
      growth,
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString()
    };
  });

  return monthlyView;
}

// Create cached version of the function
const getCachedMonthlyAnalytics = (monthsAgo: number) =>
  unstable_cache(
    () => getMonthlyAnalyticsData(monthsAgo),
    [`monthly-analytics-${monthsAgo}`],
    {
      tags: [CACHE_TAGS.MONTHLY_ANALYTICS],
      revalidate: CACHE_REVALIDATION.ANALYTICS,
    }
  )();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsAgo = parseInt(searchParams.get('monthsAgo') || '0');

    const monthlyView = await getCachedMonthlyAnalytics(monthsAgo);
    return NextResponse.json(monthlyView);
  } catch (error) {
    console.error('Monthly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly analytics' }, { status: 500 });
  }
}
