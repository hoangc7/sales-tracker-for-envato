import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { TRACKED_ITEMS } from '@/config/items';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '365'); // Default to 365 days for monthly view
    
    const db = new DatabaseService();
    const allItems = await db.getAllItems();
    
    // Filter items to only show those in current config
    const configUrls = TRACKED_ITEMS.map(item => item.url);
    const items = allItems.filter(item => configUrls.includes(item.url));
    
    // Generate monthly breakdown data for each item
    const monthlyView = await Promise.all(items.map(async (item) => {
      const salesHistory = await db.getSalesHistory(item.id, days);
      
      // Initialize 12 months (0=January, 1=February, ... 11=December) with zero sales
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyBreakdown = Array.from({ length: 12 }, (_, month) => ({
        month,
        monthName: monthNames[month],
        sales: 0
      }));
      
      // Calculate monthly sales from history
      for (let i = 0; i < salesHistory.length - 1; i++) {
        const current = salesHistory[i];
        const previous = salesHistory[i + 1];
        const monthlySales = Math.max(0, current.salesCount - previous.salesCount);
        
        // Get month from timestamp (GMT+7)
        const month = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Bangkok',
          month: 'numeric'
        }).format(current.scannedAt);
        
        const monthIndex = parseInt(month) - 1; // Convert to 0-based index
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyBreakdown[monthIndex].sales += monthlySales;
        }
      }
      
      // Calculate totals and peak month
      const totalMonthlySales = monthlyBreakdown.reduce((sum, month) => sum + month.sales, 0);
      const peakMonth = monthlyBreakdown.reduce((peak, month, index) => 
        month.sales > monthlyBreakdown[peak].sales ? index : peak, 0);
      const peakMonthSales = monthlyBreakdown[peakMonth].sales;
      
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
        monthlyBreakdown,
        totalMonthlySales,
        peakMonth,
        peakMonthSales,
        growth
      };
    }));
    
    return NextResponse.json(monthlyView);
  } catch (error) {
    console.error('Monthly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly analytics' }, { status: 500 });
  }
}