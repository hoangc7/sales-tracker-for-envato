import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    const db = new DatabaseService();
    const allItems = await db.getAllItems();
    
    // Filter items to only show those in current config
    const configUrls = TRACKED_ITEMS.map(item => item.url);
    const items = allItems.filter(item => configUrls.includes(item.url));
    
    // Generate hourly breakdown data for each item
    const dailyView = await Promise.all(items.map(async (item) => {
      const salesHistory = await db.getSalesHistory(item.id, days);
      
      // Calculate hourly sales from history - only for hours with data
      const hourlyData = new Map<number, number>();
      
      for (let i = 0; i < salesHistory.length - 1; i++) {
        const current = salesHistory[i];
        const previous = salesHistory[i + 1];
        const hourlySales = Math.max(0, current.salesCount - previous.salesCount);
        
        // Extract hour from timestamp (GMT+7)
        const hour = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Bangkok',
          hour: 'numeric',
          hour12: false
        }).format(current.scannedAt);
        
        const hourIndex = parseInt(hour);
        if (hourIndex >= 0 && hourIndex < 24) {
          hourlyData.set(hourIndex, (hourlyData.get(hourIndex) || 0) + hourlySales);
        }
      }
      
      // Convert to array format, only including hours with recorded data
      const hourlyBreakdown = Array.from(hourlyData.entries()).map(([hour, sales]) => ({
        hour,
        sales
      }));
      
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
        growth
      };
    }));
    
    return NextResponse.json(dailyView);
  } catch (error) {
    console.error('Daily analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily analytics' }, { status: 500 });
  }
}