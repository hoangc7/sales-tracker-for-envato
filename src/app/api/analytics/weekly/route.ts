import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, CACHE_REVALIDATION } from '@/lib/cache';

async function getWeeklyAnalyticsData(weeksAgo: number) {
  // Calculate the start and end of the target week
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days back to get to Monday

  // Get Monday of the target week
  const targetMonday = new Date(now);
  targetMonday.setDate(now.getDate() - daysToMonday - (weeksAgo * 7));
  targetMonday.setHours(0, 0, 0, 0);

  // Get Sunday of the target week (end of week)
  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetMonday.getDate() + 6);
  targetSunday.setHours(23, 59, 59, 999);

  const db = new DatabaseService();
  const allItems = await db.getAllItems();

  // Filter items to only show those in current config
  const configUrls = TRACKED_ITEMS.map(item => item.url);
  const items = allItems.filter(item => configUrls.includes(item.url));

  // OPTIMIZATION: Fetch all sales history in one query instead of N queries
  const itemIds = items.map(item => item.id);
  const batchSalesHistory = await db.getBatchSalesHistory(itemIds, 30);

  // Generate daily breakdown data for each item
  const weeklyView = items.map((item) => {
    // Get sales history for this item from the batch result
    const salesHistory = batchSalesHistory.get(item.id) || [];

    // Initialize daily breakdown - only include past days for current week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyBreakdown: Array<{ day: number; dayName: string; sales: number }> = [];

    // For current week (weeksAgo=0), only include days up to today (in Monday-based week)
    // For past weeks, include all 7 days
    const melbourneNow = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
    const currentDayOfWeek = melbourneNow.getDay(); // 0=Sunday, 1=Monday, etc.

    // Convert to Monday-based week position: Monday=0, Tuesday=1, ..., Sunday=6
    const currentWeekPosition = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    // For current week, include Monday through today
    // For past weeks, include all 7 days (Monday through Sunday)
    const maxWeekPosition = weeksAgo === 0 ? currentWeekPosition : 6;

    // Add days in Monday-first order: Monday=1, Tuesday=2, ..., Sunday=0
    const mondayBasedOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

    for (let weekPos = 0; weekPos <= maxWeekPosition; weekPos++) {
      const actualDay = mondayBasedOrder[weekPos]; // Convert week position to actual day number
      dailyBreakdown.push({
        day: actualDay,
        dayName: dayNames[actualDay],
        sales: 0
      });
    }

    // Calculate daily sales from history - only for the target week
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];
      const previous = salesHistory[i + 1];

      // Check if this record is within our target week
      if (current.scannedAt >= targetMonday && current.scannedAt <= targetSunday) {
        const dailySales = Math.max(0, current.salesCount - previous.salesCount);

        // Get day of week in GMT+7
        const dayOfWeek = current.scannedAt.getDay(); // 0 = Sunday

        // Only add sales if this day is included in our breakdown (for current week, exclude future days)
        const dayEntry = dailyBreakdown.find(d => d.day === dayOfWeek);
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
      author: item.author || undefined,
      category: item.category || undefined,
      latestSales: salesHistory[0]?.salesCount || 0,
      latestPrice: salesHistory[0]?.price || undefined,
      lastScanned: salesHistory[0]?.scannedAt?.toISOString(),
      dailyBreakdown,
      totalWeeklySales,
      peakDay,
      peakDaySales,
      growth,
      weekStart: targetMonday.toISOString(),
      weekEnd: targetSunday.toISOString()
    };
  });

  return weeklyView;
}

// Create cached version of the function
const getCachedWeeklyAnalytics = (weeksAgo: number) =>
  unstable_cache(
    () => getWeeklyAnalyticsData(weeksAgo),
    [`weekly-analytics-${weeksAgo}`],
    {
      tags: [CACHE_TAGS.WEEKLY_ANALYTICS],
      revalidate: CACHE_REVALIDATION.ANALYTICS,
    }
  )();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weeksAgo = parseInt(searchParams.get('weeksAgo') || '0');

    const weeklyView = await getCachedWeeklyAnalytics(weeksAgo);
    return NextResponse.json(weeklyView);
  } catch (error) {
    console.error('Weekly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly analytics' }, { status: 500 });
  }
}
