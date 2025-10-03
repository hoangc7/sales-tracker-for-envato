import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysAgo = parseInt(searchParams.get('daysAgo') || '0'); // 0 = today, 1 = yesterday, etc.

    // Calculate the start and end of the target day
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - daysAgo);

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const db = new DatabaseService();
    const allItems = await db.getAllItems();

    // Filter items to only show those in current config
    const configUrls = TRACKED_ITEMS.map(item => item.url);
    const items = allItems.filter(item => configUrls.includes(item.url));

    // Generate hourly breakdown data for each item
    const dailyView = await Promise.all(items.map(async (item) => {
      // Get sales history for a broader range to calculate growth
      const salesHistory = await db.getSalesHistory(item.id, 7);

      // Calculate hourly sales from history - include all scanned hours
      const hourlyData = new Map<number, number>();
      const scannedHours = new Set<number>();

      for (let i = 0; i < salesHistory.length - 1; i++) {
        const current = salesHistory[i];
        const previous = salesHistory[i + 1];

        // Check if this record is within our target day
        if (current.scannedAt >= dayStart && current.scannedAt <= dayEnd) {
          const hourlySales = Math.max(0, current.salesCount - previous.salesCount);

          // Extract hour from timestamp (Melbourne timezone)
          const hour = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Australia/Melbourne',
            hour: 'numeric',
            hour12: false
          }).format(current.scannedAt);

          const hourIndex = parseInt(hour);
          if (hourIndex >= 0 && hourIndex < 24) {
            // Track that this hour was scanned
            scannedHours.add(hourIndex);
            // Add sales for this hour
            hourlyData.set(hourIndex, (hourlyData.get(hourIndex) || 0) + hourlySales);
          }
        }
      }

      // Create hourly breakdown only for past hours (and current hour)
      const now = new Date();
      const currentHour = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Australia/Melbourne',
        hour: 'numeric',
        hour12: false
      }).format(now);
      const currentHourIndex = parseInt(currentHour);

      // For days other than today, include all 24 hours
      // For today, only include hours up to and including the current hour
      const maxHour = daysAgo === 0 ? currentHourIndex : 23;

      const hourlyBreakdown = [];
      for (let hour = 0; hour <= maxHour; hour++) {
        hourlyBreakdown.push({
          hour,
          sales: scannedHours.has(hour) ? (hourlyData.get(hour) || 0) : 0
        });
      }

      // Calculate totals and peak hour
      const totalDailySales = hourlyBreakdown.reduce((sum, hour) => sum + hour.sales, 0);
      const peakHourData = hourlyBreakdown.reduce((peak, hour) =>
        hour.sales > peak.sales ? hour : peak, { hour: 0, sales: 0 });
      const peakHour = peakHourData.hour;
      const peakHourSales = peakHourData.sales;

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
        hourlyBreakdown,
        totalDailySales,
        peakHour,
        peakHourSales,
        growth,
        dayStart: dayStart.toISOString(),
        dayEnd: dayEnd.toISOString()
      };
    }));

    return NextResponse.json(dailyView);
  } catch (error) {
    console.error('Daily analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily analytics' }, { status: 500 });
  }
}
