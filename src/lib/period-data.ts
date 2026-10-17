import { DatabaseService, SalesRecordRow, TrackedItemRow } from './database';
import { TRACKED_ITEMS } from '@/config/items';

export interface TrackedItemSales {
  item: TrackedItemRow;
  /** Records inside the requested window plus one baseline before it, newest first. */
  records: SalesRecordRow[];
  /** Most recent record overall, independent of the requested window. */
  latest?: SalesRecordRow;
}

/**
 * Tracked items (in config order, so `[0]` is the reference item) with their sales
 * records for `[start, end]`. Two indexed queries for the whole dashboard, run in parallel,
 * instead of loading a fixed number of days of history for every item.
 */
export async function loadTrackedItemSales(start: Date, end: Date): Promise<TrackedItemSales[]> {
  const db = new DatabaseService();
  const items = (await db.getItemsByUrls(TRACKED_ITEMS.map(item => item.url)))
    .filter((item): item is TrackedItemRow => item !== undefined);

  const itemIds = items.map(item => item.id);
  const [records, latest] = await Promise.all([
    db.getSalesRecordsInRange(itemIds, start, end),
    db.getLatestSalesRecords(itemIds),
  ]);

  return items.map(item => ({
    item,
    records: records.get(item.id) ?? [],
    latest: latest.get(item.id),
  }));
}

/** Fields every analytics route returns for an item. */
export function itemSummary({ item, latest }: TrackedItemSales) {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    envatoId: item.envatoId,
    author: item.author || undefined,
    category: item.category || undefined,
    latestSales: latest?.salesCount || 0,
    latestPrice: latest?.price || undefined,
    lastScanned: latest?.scannedAt?.toISOString(),
  };
}
