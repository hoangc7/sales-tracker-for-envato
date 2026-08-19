import { DatabaseService } from './database';
import {
  DEFAULT_TIMEZONE,
  formatDateKeyInTimezone,
  formatInTimezone,
  getDatePartsInTimezone,
  getWeekBoundariesInTimezone,
} from './timezone';

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
  constructor() {
    this.db = new DatabaseService();
  }

  // Periods are bucketed in DEFAULT_TIMEZONE, the same boundaries the analytics routes
  // and lib/sales-periods.ts use, so numbers from here agree with the dashboards.
  private formatHourKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    }).format(date).replace(',', '');
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
        hour: this.formatHourKey(current.scannedAt),
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

  private calculateWeeklyData(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): WeeklySalesData[] {
    const weeks = new Map<string, {
      weekStart: string;
      weekEnd: string;
      weeklySales: number;
      totalSales: number;
      prices: number[];
    }>();

    // salesHistory is newest-first. Each scan's delta is attributed to that scan's
    // timestamp and summed into its Mon-Sun week, matching lib/sales-periods.ts. The
    // previous "last - first record in the week" approach silently dropped the sales
    // made between the last scan of one week and the first scan of the next.
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];
      const delta = Math.max(0, current.salesCount - salesHistory[i + 1].salesCount);

      const { start, end } = getWeekBoundariesInTimezone(current.scannedAt);
      const key = formatDateKeyInTimezone(start);

      let week = weeks.get(key);
      if (!week) {
        week = {
          weekStart: key,
          weekEnd: formatDateKeyInTimezone(end),
          weeklySales: 0,
          totalSales: 0,
          prices: []
        };
        weeks.set(key, week);
      }

      week.weeklySales += delta;
      week.totalSales = Math.max(week.totalSales, current.salesCount);
      if (current.price) week.prices.push(current.price);
    }

    return Array.from(weeks.values())
      .map(week => ({
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        weeklySales: week.weeklySales,
        totalSales: week.totalSales,
        averagePrice: week.prices.length > 0
          ? week.prices.reduce((sum, price) => sum + price, 0) / week.prices.length
          : undefined
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  private calculateMonthlyData(salesHistory: Array<{salesCount: number; scannedAt: Date; price?: number | null}>): MonthlySalesData[] {
    const months = new Map<string, {
      month: string;
      year: number;
      monthlySales: number;
      totalSales: number;
      prices: number[];
    }>();

    // Same delta-attribution as the weekly aggregation above, bucketed by calendar month
    // in DEFAULT_TIMEZONE rather than by the process clock's getMonth()/getFullYear().
    for (let i = 0; i < salesHistory.length - 1; i++) {
      const current = salesHistory[i];
      const delta = Math.max(0, current.salesCount - salesHistory[i + 1].salesCount);

      const { year, month } = getDatePartsInTimezone(current.scannedAt);
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      let entry = months.get(key);
      if (!entry) {
        entry = {
          month: formatInTimezone(current.scannedAt, { month: 'long' }),
          year,
          monthlySales: 0,
          totalSales: 0,
          prices: []
        };
        months.set(key, entry);
      }

      entry.monthlySales += delta;
      entry.totalSales = Math.max(entry.totalSales, current.salesCount);
      if (current.price) entry.prices.push(current.price);
    }

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, entry]) => ({
        month: entry.month,
        year: entry.year,
        monthlySales: entry.monthlySales,
        totalSales: entry.totalSales,
        averagePrice: entry.prices.length > 0
          ? entry.prices.reduce((sum, price) => sum + price, 0) / entry.prices.length
          : undefined
      }));
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