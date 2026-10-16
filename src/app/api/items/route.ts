import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';
import { getDayBoundariesDaysAgo, getWeekBoundariesInTimezone } from '@/lib/timezone';
import { getDailySalesTotals, sumSalesInRange } from '@/lib/sales-periods';

export const dynamic = 'force-dynamic';

const DAILY_SALES_DAYS = 7;

function emptyItem(item: (typeof TRACKED_ITEMS)[number]) {
  return {
    id: null,
    name: item.name,
    url: item.url,
    envatoId: item.envatoId,
    author: null,
    category: null,
    latestSales: 0,
    latestPrice: null,
    lastScanned: null,
    weeklySales: 0,
    dailySales: [],
  };
}

export async function GET() {
  try {
    const db = new DatabaseService();

    // Only show items in the current config, ordered exactly as configured so the
    // reference item (first row) is stable and matches the other dashboards.
    const items = await db.getItemsByUrls(TRACKED_ITEMS.map(item => item.url));
    const trackedIds = items.flatMap(item => (item ? [item.id] : []));

    if (trackedIds.length === 0) {
      return NextResponse.json(TRACKED_ITEMS.map(emptyItem));
    }

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekBoundariesInTimezone(now);
    const today = getDayBoundariesDaysAgo(now, 0);
    const oldestReportedDay = getDayBoundariesDaysAgo(now, DAILY_SALES_DAYS - 1);
    // Covers both windows we report on (the last 7 calendar days and the current Mon–Sun
    // week); the range query adds the scan preceding it as the baseline for the first delta.
    const historyStart = weekStart < oldestReportedDay.start ? weekStart : oldestReportedDay.start;

    const [batchSalesHistory, latestRecords] = await Promise.all([
      db.getSalesRecordsInRange(trackedIds, historyStart, today.end),
      db.getLatestSalesRecords(trackedIds),
    ]);

    const itemsWithStats = TRACKED_ITEMS.map((configItem, index) => {
      const item = items[index];
      if (!item) return emptyItem(configItem);

      const salesHistory = batchSalesHistory.get(item.id) || [];
      const latest = latestRecords.get(item.id);

      return {
        id: item.id,
        name: item.name,
        url: item.url,
        envatoId: item.envatoId,
        author: item.author,
        category: item.category,
        latestSales: latest?.salesCount || 0,
        latestPrice: latest?.price ?? null,
        lastScanned: latest?.scannedAt ?? null,
        // Current Monday–Sunday calendar week, identical boundaries to /api/analytics/weekly
        weeklySales: sumSalesInRange(salesHistory, weekStart, weekEnd),
        // Per calendar day (newest first), not per scan interval
        dailySales: getDailySalesTotals(salesHistory, DAILY_SALES_DAYS, now),
      };
    });

    return NextResponse.json(itemsWithStats);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
