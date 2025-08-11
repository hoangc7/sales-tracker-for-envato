import { DatabaseService } from './database';

export interface HourlySalesData {
  hour: string; // ISO string with hour precision
  hourlySales: number;
  totalSales: number;
  price?: number;
}

export interface DailySalesData {
  date: string;
  dailySales: number;
  totalSales: number;
  price?: number;
  hourlyBreakdown: HourlySalesData[];
}

export interface WeeklySalesData {
  weekStart: string;
  weekEnd: string;
  weeklySales: number;
  totalSales: number;
  averagePrice?: number;
}

export interface MonthlySalesData {
  month: string;
  year: number;
  monthlySales: number;
  totalSales: number;
  averagePrice?: number;
}

export interface ItemAnalytics {
  id: string;
  name: string;
  url: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  hourlyData: HourlySalesData[];
  dailyData: DailySalesData[];
  weeklyData: WeeklySalesData[];
  monthlyData: MonthlySalesData[];
  totalGrowth: {
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export class AnalyticsService {
  private db: DatabaseService;
  private readonly GMT7_TIMEZONE = 'Asia/Bangkok';

  constructor() {
    this.db = new DatabaseService();
  }

  private toGMT7Date(date: Date): Date {
    // Convert UTC date to GMT+7 equivalent
    const utcTime = date.getTime();
    const gmt7Offset = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
    return new Date(utcTime + gmt7Offset);
  }

  private formatGMT7Hour(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.GMT7_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    }).format(date).replace(',', '');
  }

  private formatGMT7Date(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.GMT7_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  async getItemAnalytics(itemId: string, days: number = 30): Promise<ItemAnalytics> {
    const item = await this.db.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        salesRecords: {
          orderBy: { scannedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const salesHistory = await this.db.getSalesHistory(itemId, days);
    
    const hourlyData = this.calculateHourlyData(salesHistory);
    const dailyData = this.calculateDailyDataWithHourly(salesHistory);
    const weeklyData = this.calculateWeeklyData(salesHistory);
    const monthlyData = this.calculateMonthlyData(salesHistory);

    return {
      id: item.id,
      name: item.name,
      url: item.url,
      author: item.author ?? undefined,
      category: item.category ?? undefined,
      latestSales: item.salesRecords[0]?.salesCount || 0,
      latestPrice: item.salesRecords[0]?.price ?? undefined,
      lastScanned: item.salesRecords[0]?.scannedAt?.toISOString(),
      hourlyData,
      dailyData,
      weeklyData,
      monthlyData,
      totalGrowth: {
        hourly: this.calculateGrowthRate(hourlyData, 'hourly'),
        daily: this.calculateGrowthRate(dailyData, 'daily'),
        weekly: this.calculateGrowthRate(weeklyData, 'weekly'),
        monthly: this.calculateGrowthRate(monthlyData, 'monthly')
      }
    };
  }

  async getAllItemsAnalytics(days: number = 30): Promise<ItemAnalytics[]> {
    const items = await this.db.getAllItems();
    
    const analytics = await Promise.all(
      items.map(item => this.getItemAnalytics(item.id, days))
    );

    return analytics;
  }

  private calculateHourlyData(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): HourlySalesData[] {
    const hourlyData: HourlySalesData[] = [];
    
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];
      const previous = salesHistory[i + 1];
      const hourlySales = Math.max(0, current.salesCount - previous.salesCount);
      
      hourlyData.push({
        hour: this.formatGMT7Hour(current.scannedAt),
        hourlySales,
        totalSales: current.salesCount,
        price: current.price ?? undefined
      });
    }

    return hourlyData.reverse(); // Oldest first
  }

  private calculateDailyDataWithHourly(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): DailySalesData[] {
    const dailyMap = new Map<string, {
      dailySales: number;
      totalSales: number;
      price?: number;
      hourlyBreakdown: HourlySalesData[];
    }>();

    // First calculate hourly data
    const hourlyData = this.calculateHourlyData(salesHistory);
    
    // Group hourly data by date
    hourlyData.forEach(hourData => {
      const date = hourData.hour.split(' ')[0]; // Extract date part
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          dailySales: 0,
          totalSales: hourData.totalSales,
          price: hourData.price,
          hourlyBreakdown: []
        });
      }
      
      const dayData = dailyMap.get(date)!;
      dayData.dailySales += hourData.hourlySales;
      dayData.hourlyBreakdown.push(hourData);
      // Keep the latest total sales for the day
      if (hourData.totalSales > dayData.totalSales) {
        dayData.totalSales = hourData.totalSales;
        dayData.price = hourData.price;
      }
    });

    const dailyData: DailySalesData[] = [];
    for (const [date, data] of dailyMap.entries()) {
      dailyData.push({
        date,
        dailySales: data.dailySales,
        totalSales: data.totalSales,
        price: data.price,
        hourlyBreakdown: data.hourlyBreakdown.sort((a, b) => a.hour.localeCompare(b.hour))
      });
    }

    return dailyData.sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateDailyData(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): DailySalesData[] {
    const dailyData: DailySalesData[] = [];
    
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];
      const previous = salesHistory[i + 1];
      const dailySales = Math.max(0, current.salesCount - previous.salesCount);
      
      dailyData.push({
        date: this.formatGMT7Date(current.scannedAt),
        dailySales,
        totalSales: current.salesCount,
        price: current.price ?? undefined,
        hourlyBreakdown: [] // Empty for backward compatibility
      });
    }

    return dailyData.reverse(); // Oldest first
  }

  private calculateWeeklyData(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): WeeklySalesData[] {
    const weeklyMap = new Map<string, {weekStart: string; weekEnd: string; records: Array<{salesCount: number; scannedAt: Date; price?: number | null}>}>();
    
    salesHistory.forEach(record => {
      const date = new Date(record.scannedAt);
      const weekStart = this.getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyMap.has(weekKey)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        weeklyMap.set(weekKey, {
          weekStart: weekKey,
          weekEnd: weekEnd.toISOString().split('T')[0],
          records: []
        });
      }
      
      weeklyMap.get(weekKey)!.records.push(record);
    });

    const weeklyData: WeeklySalesData[] = [];
    
    for (const [, weekData] of weeklyMap.entries()) {
      const sortedRecords = weekData.records.sort((a, b) => 
        new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
      );
      
      if (sortedRecords.length >= 2) {
        const firstRecord = sortedRecords[0];
        const lastRecord = sortedRecords[sortedRecords.length - 1];
        const weeklySales = Math.max(0, lastRecord.salesCount - firstRecord.salesCount);
        
        const recordsWithPrice = sortedRecords.filter(r => r.price);
        const avgPrice = recordsWithPrice.length > 0 ? 
          recordsWithPrice.reduce((sum, r) => sum + r.price!, 0) / recordsWithPrice.length : undefined;

        weeklyData.push({
          weekStart: weekData.weekStart,
          weekEnd: weekData.weekEnd,
          weeklySales,
          totalSales: lastRecord.salesCount,
          averagePrice: avgPrice || undefined
        });
      }
    }

    return weeklyData.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  private calculateMonthlyData(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): MonthlySalesData[] {
    const monthlyMap = new Map<string, {month: string; year: number; records: Array<{salesCount: number; scannedAt: Date; price?: number | null}>}>();
    
    salesHistory.forEach(record => {
      const date = new Date(record.scannedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: date.toLocaleDateString('en-US', { month: 'long' }),
          year: date.getFullYear(),
          records: []
        });
      }
      
      monthlyMap.get(monthKey)!.records.push(record);
    });

    const monthlyData: MonthlySalesData[] = [];
    
    for (const [, monthData] of monthlyMap.entries()) {
      const sortedRecords = monthData.records.sort((a, b) => 
        new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
      );
      
      if (sortedRecords.length >= 2) {
        const firstRecord = sortedRecords[0];
        const lastRecord = sortedRecords[sortedRecords.length - 1];
        const monthlySales = Math.max(0, lastRecord.salesCount - firstRecord.salesCount);
        
        const recordsWithPrice = sortedRecords.filter(r => r.price);
        const avgPrice = recordsWithPrice.length > 0 ? 
          recordsWithPrice.reduce((sum, r) => sum + r.price!, 0) / recordsWithPrice.length : undefined;

        monthlyData.push({
          month: monthData.month,
          year: monthData.year,
          monthlySales,
          totalSales: lastRecord.salesCount,
          averagePrice: avgPrice || undefined
        });
      }
    }

    return monthlyData.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth();
    });
  }

  private getWeekStart(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  }

  private calculateGrowthRate(data: Array<{hourlySales?: number; dailySales?: number; weeklySales?: number; monthlySales?: number}>, type: 'hourly' | 'daily' | 'weekly' | 'monthly'): number {
    if (data.length < 2) return 0;

    const recent = data.slice(-7); // Last 7 periods
    const previous = data.slice(-14, -7); // Previous 7 periods

    if (recent.length === 0 || previous.length === 0) return 0;

    const recentAvg = recent.reduce((sum, item) => {
      return sum + (type === 'hourly' ? (item.hourlySales ?? 0) :
                   type === 'daily' ? (item.dailySales ?? 0) : 
                   type === 'weekly' ? (item.weeklySales ?? 0) : 
                   (item.monthlySales ?? 0));
    }, 0) / recent.length;

    const previousAvg = previous.reduce((sum, item) => {
      return sum + (type === 'hourly' ? (item.hourlySales ?? 0) :
                   type === 'daily' ? (item.dailySales ?? 0) : 
                   type === 'weekly' ? (item.weeklySales ?? 0) : 
                   (item.monthlySales ?? 0));
    }, 0) / previous.length;

    if (previousAvg === 0) return 0;
    return ((recentAvg - previousAvg) / previousAvg) * 100;
  }
}