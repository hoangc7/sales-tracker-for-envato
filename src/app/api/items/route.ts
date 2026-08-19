import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';
import { getWeekBoundariesInTimezone } from '@/lib/timezone';
import { getDailySalesTotals, sumSalesInRange } from '@/lib/sales-periods';

export const dynamic = 'force-dynamic';

const DAILY_SALES_DAYS = 7;
// Covers both windows we report on (the last 7 calendar days and the current Mon–Sun
// week, which starts at most ~7 days back) plus a margin, so the scan preceding the
// oldest reported day is always available to compute that day's first delta.
const HISTORY_DAYS = 10;

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
    const allItems = await db.getAllItems();

    // Only show items in the current config, ordered exactly as configured so the
    // reference item (first row) is stable and matches the other dashboards.
    const items = TRACKED_ITEMS.map(configItem =>
      allItems.find(item => item.url === configItem.url)
    );

    const trackedItems = items.filter(item => item !== undefined);

    if (trackedItems.length === 0) {
      return NextResponse.json(TRACKED_ITEMS.map(emptyItem));
    }

    // Single batched query for every item's history, same as the analytics routes.
    const batchSalesHistory = await db.getBatchSalesHistory(
      trackedItems.map(item => item.id),
      HISTORY_DAYS
    );

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekBoundariesInTimezone(now);

    const itemsWithStats = TRACKED_ITEMS.map((configItem, index) => {
      const item = items[index];
      if (!item) return emptyItem(configItem);

      const salesHistory = batchSalesHistory.get(item.id) || [];

      return {
        id: item.id,
        name: item.name,
        url: item.url,
        envatoId: item.envatoId,
        author: item.author,
        category: item.category,
        latestSales: item.salesRecords[0]?.salesCount || 0,
        latestPrice: item.salesRecords[0]?.price ?? null,
        lastScanned: item.salesRecords[0]?.scannedAt ?? null,
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
