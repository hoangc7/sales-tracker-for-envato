import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Logging every query is costly on hot analytics routes; keep it to local development.
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export interface ItemData {
  name: string;
  url: string;
  envatoId: string;
  author?: string;
  category?: string;
}

export interface SalesData {
  itemId: string;
  salesCount: number;
  price?: number;
  scannedAt?: Date;
}

export interface SalesRecordRow {
  itemId: string;
  salesCount: number;
  price: number | null;
  scannedAt: Date;
}

export interface TrackedItemRow {
  id: string;
  name: string;
  url: string;
  envatoId: string;
  author: string | null;
  category: string | null;
}

export class DatabaseService {
  public prisma = prisma;
  async createItem(data: ItemData) {
    return prisma.item.create({
      data,
    });
  }

  async getItem(url: string) {
    return prisma.item.findUnique({
      where: { url },
    });
  }

  async getAllItems() {
    const items = await prisma.item.findMany();
    const latest = await this.getLatestSalesRecords(items.map(item => item.id));
    return items.map(item => {
      const record = latest.get(item.id);
      return { ...item, salesRecords: record ? [record] : [] };
    });
  }

  async getAllItemsForScan(urls?: string[]) {
    // Optimized version for scanning - only fetch required fields
    return prisma.item.findMany({
      where: urls ? { url: { in: urls } } : undefined,
      select: {
        id: true,        // Required for createSalesRecord
        envatoId: true,  // Required for API call
      },
    });
  }

  /**
   * Items whose URL is in `urls`, returned in the same order as `urls`. Missing items are
   * `undefined` so callers can line results up with the config list.
   */
  async getItemsByUrls(urls: string[]): Promise<Array<TrackedItemRow | undefined>> {
    const items = await prisma.item.findMany({
      where: { url: { in: urls } },
      select: { id: true, name: true, url: true, envatoId: true, author: true, category: true },
    });
    const byUrl = new Map(items.map(item => [item.url, item]));
    return urls.map(url => byUrl.get(url));
  }

  /**
   * Latest sales record per item in a single indexed query. Prisma's nested
   * `include: { salesRecords: { take: 1 } }` paginates in memory, i.e. it loads every
   * record of every item just to keep one.
   */
  async getLatestSalesRecords(itemIds: string[]): Promise<Map<string, SalesRecordRow>> {
    if (itemIds.length === 0) return new Map();

    const rows = await prisma.$queryRaw<SalesRecordRow[]>`
      SELECT DISTINCT ON ("itemId") "itemId", "salesCount", "price", "scannedAt"
      FROM "sales_records"
      WHERE "itemId" IN (${Prisma.join(itemIds)})
      ORDER BY "itemId", "scannedAt" DESC
    `;
    return new Map(rows.map(row => [row.itemId, row]));
  }

  /**
   * Every record with `start <= scannedAt <= end`, plus the latest record before `start`
   * for each item (the baseline needed to compute the first delta inside the range).
   * Grouped by item, newest first — the shape `lib/sales-periods.ts` expects.
   *
   * Fetching exactly the requested window keeps the payload proportional to the period
   * shown, and lets the dashboards navigate arbitrarily far back.
   */
  async getSalesRecordsInRange(
    itemIds: string[],
    start: Date,
    end: Date
  ): Promise<Map<string, SalesRecordRow[]>> {
    const grouped = new Map<string, SalesRecordRow[]>(itemIds.map(id => [id, []]));
    if (itemIds.length === 0) return grouped;

    const [inRange, baselines] = await Promise.all([
      prisma.salesRecord.findMany({
        where: { itemId: { in: itemIds }, scannedAt: { gte: start, lte: end } },
        select: { itemId: true, salesCount: true, price: true, scannedAt: true },
        orderBy: { scannedAt: 'desc' },
      }),
      prisma.$queryRaw<SalesRecordRow[]>`
        SELECT DISTINCT ON ("itemId") "itemId", "salesCount", "price", "scannedAt"
        FROM "sales_records"
        WHERE "itemId" IN (${Prisma.join(itemIds)}) AND "scannedAt" < ${start}
        ORDER BY "itemId", "scannedAt" DESC
      `,
    ]);

    for (const record of inRange) {
      grouped.get(record.itemId)!.push(record);
    }
    for (const baseline of baselines) {
      grouped.get(baseline.itemId)!.push(baseline);
    }

    return grouped;
  }

  async createSalesRecord(data: SalesData) {
    return prisma.salesRecord.create({
      data: {
        itemId: data.itemId,
        salesCount: data.salesCount,
        price: data.price,
        // scannedAt will use @default(now()) with Melbourne timezone
        ...(data.scannedAt && { scannedAt: data.scannedAt }),
      },
    });
  }

  async getSalesHistory(itemId: string, days?: number) {
    const where = { itemId };
    const orderBy = { scannedAt: 'desc' as const };

    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      Object.assign(where, {
        scannedAt: { gte: since },
      });
    }

    return prisma.salesRecord.findMany({
      where,
      orderBy,
    });
  }

  async getOldestSaleRecord() {
    return prisma.salesRecord.findFirst({
      orderBy: { scannedAt: 'asc' },
      select: { scannedAt: true },
    });
  }

  async getNewestSaleRecord() {
    return prisma.salesRecord.findFirst({
      orderBy: { scannedAt: 'desc' },
      select: { scannedAt: true },
    });
  }

  async deleteItem(itemId: string) {
    // Delete all sales records first (due to foreign key constraint)
    await prisma.salesRecord.deleteMany({
      where: { itemId },
    });

    // Then delete the item
    return prisma.item.delete({
      where: { id: itemId },
    });
  }

  // Optimized batch query - fetch sales history for all items in one query
  async getBatchSalesHistory(itemIds: string[], days?: number) {
    const where: {
      itemId: { in: string[] };
      scannedAt?: { gte: Date };
    } = { itemId: { in: itemIds } };
    
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.scannedAt = { gte: since };
    }

    const records = await prisma.salesRecord.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
    });

    // Group by itemId for easier processing
    const grouped = new Map<string, typeof records>();
    for (const record of records) {
      if (!grouped.has(record.itemId)) {
        grouped.set(record.itemId, []);
      }
      grouped.get(record.itemId)!.push(record);
    }

    return grouped;
  }
}
