import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90'); // Default to 90 days for weekly view
    
    const db = new DatabaseService();
    const items = await db.getAllItems();
    
    // Generate daily breakdown data for each item
    const weeklyView = await Promise.all(items.map(async (item) => {
      const salesHistory = await db.getSalesHistory(item.id, days);
      
      // Initialize 7 days (0=Sunday, 1=Monday, ... 6=Saturday) with zero sales
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyBreakdown = Array.from({ length: 7 }, (_, day) => ({
        day,
        dayName: dayNames[day],
        sales: 0
      }));
      
      // Calculate daily sales from history
      for (let i = 0; i < salesHistory.length - 1; i++) {
        const current = salesHistory[i];
        const previous = salesHistory[i + 1];
        const dailySales = Math.max(0, current.salesCount - previous.salesCount);
        
        // Get day of week in GMT+7
        const dayOfWeek = current.scannedAt.getDay(); // 0 = Sunday
        dailyBreakdown[dayOfWeek].sales += dailySales;
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
        growth
      };
    }));
    
    return NextResponse.json(weeklyView);
  } catch (error) {
    console.error('Weekly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly analytics' }, { status: 500 });
  }
}