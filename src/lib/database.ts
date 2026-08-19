import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
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
    return prisma.item.findMany({
      include: {
        salesRecords: {
          orderBy: { scannedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getAllItemsForScan() {
    // Optimized version for scanning - only fetch required fields
    return prisma.item.findMany({
      select: {
        id: true,        // Required for createSalesRecord
        envatoId: true,  // Required for API call
      },
    });
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
    });
  }

  async getNewestSaleRecord() {
    return prisma.salesRecord.findFirst({
      orderBy: { scannedAt: 'desc' },
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
