import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';

export async function GET() {
  try {
    const db = new DatabaseService();
    const allItems = await db.getAllItems();
    
    // Filter items to only show those in current config
    const configUrls = TRACKED_ITEMS.map(item => item.url);
    const items = allItems.filter(item => configUrls.includes(item.url));
    
    const itemsWithStats = await Promise.all(
      items.map(async (item) => {
        const dailySales = await db.getDailySales(item.id, 7);
        const weeklySales = dailySales.reduce((sum, day) => sum + day.dailySales, 0);
        
        return {
          id: item.id,
          name: item.name,
          url: item.url,
          author: item.author,
          category: item.category,
          latestSales: item.salesRecords[0]?.salesCount || 0,
          latestPrice: item.salesRecords[0]?.price,
          lastScanned: item.salesRecords[0]?.scannedAt,
          weeklySales,
          dailySales,
        };
      })
    );
    
    return NextResponse.json(itemsWithStats);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}