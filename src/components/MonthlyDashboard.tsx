'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOldestDate } from '@/hooks/useOldestDate';

interface DailyBreakdown {
  day: number; // 1-31 (day of month)
  sales: number;
}

interface MonthlyItemData {
  id: string;
  name: string;
  url: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  dailyBreakdown: DailyBreakdown[]; // Days of the month (1-31)
  totalMonthlySales: number;
  peakDay: number; // Day with most sales (1-31)
  peakDaySales: number;
  growth: number;
  monthStart: string;
  monthEnd: string;
}

export function MonthlyDashboard() {
  const [items, setItems] = useState<MonthlyItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthsAgo, setMonthsAgo] = useState(0); // 0 = current month, 1 = last month, etc.
  const { canGoToPreviousMonth } = useOldestDate();

  const fetchMonthlyData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/monthly?monthsAgo=${monthsAgo}`);
      if (!response.ok) {
        throw new Error('Failed to fetch monthly analytics');
      }
      const data = await response.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [monthsAgo]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getMostActiveDay = (items: MonthlyItemData[]) => {
    const dayTotals = new Map<number, number>();
    items.forEach(item => {
      item.dailyBreakdown.forEach(dayData => {
        dayTotals.set(dayData.day, (dayTotals.get(dayData.day) || 0) + dayData.sales);
      });
    });

    let maxSales = 0;
    let mostActiveDay = 1;
    dayTotals.forEach((sales, day) => {
      if (sales > maxSales) {
        maxSales = sales;
        mostActiveDay = day;
      }
    });

    return mostActiveDay;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatMonthRange = (monthStart: string, monthEnd: string) => {
    const start = new Date(monthStart);
    const end = new Date(monthEnd);

    return start.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const getMonthTitle = () => {
    if (monthsAgo === 0) return 'This Month';
    if (monthsAgo === 1) return 'Last Month';
    return `${monthsAgo} Months Ago`;
  };

  const goToPreviousMonth = () => setMonthsAgo(prev => prev + 1);
  const goToNextMonth = () => setMonthsAgo(prev => Math.max(0, prev - 1));
  const goToCurrentMonth = () => setMonthsAgo(0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg">Loading monthly breakdown...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  const sortedItems = [...items].sort((a, b) => b.totalMonthlySales - a.totalMonthlySales);

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monthly Sales Analytics</h2>
          <p className="text-gray-600">
            {getMonthTitle()} • {items.length > 0 && formatMonthRange(items[0].monthStart, items[0].monthEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            disabled={!canGoToPreviousMonth(monthsAgo)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              !canGoToPreviousMonth(monthsAgo)
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={!canGoToPreviousMonth(monthsAgo) ? "No older data available" : "Previous month"}
          >
            ← Previous
          </button>
          <button
            onClick={goToNextMonth}
            disabled={monthsAgo === 0}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              monthsAgo === 0
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Next month"
          >
            Next →
          </button>
          {monthsAgo > 0 && (
            <button
              onClick={goToCurrentMonth}
              className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              title="Go to current month"
            >
              This Month
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Monthly Sales</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(items.reduce((sum, item) => sum + item.totalMonthlySales, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Peak Day</h3>
          <p className="text-2xl font-bold text-blue-600">
            {getMostActiveDay(items)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Monthly Leader</h3>
          <p className="text-lg font-bold text-gray-900">
            {sortedItems[0]?.name || 'N/A'}
          </p>
        </div>
      </div>

      {/* Monthly Analytics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                {/* Item Column */}
                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[280px]">
                  Item
                </th>
                {/* Total Sales Column */}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 min-w-[100px]">
                  Total
                </th>
                {/* 12 Month Columns (Jan-Dec) */}
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((monthName, index) => (
                  <th
                    key={index}
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px]"
                    title={`${monthName} sales`}
                  >
                    {monthName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedItems.map((item, index) => {
                // Get the actual month index from the monthStart date
                const currentMonthIndex = new Date(item.monthStart).getMonth(); // 0=Jan, 1=Feb, ..., 11=Dec

                // Create array with sales for each month (0=Jan, 1=Feb, ..., 11=Dec)
                const monthlySales = new Array(12).fill(0);
                item.dailyBreakdown.forEach(dayData => {
                  // Put all daily sales into the correct current month
                  monthlySales[currentMonthIndex] += dayData.sales;
                });

                const maxMonthlySales = Math.max(...monthlySales);

                return (
                  <tr key={item.id} className={index === 0 ? 'bg-purple-50' : 'hover:bg-gray-50'}>
                    {/* Item Column - Sticky */}
                    <td className="sticky left-0 bg-white px-6 py-4 border-r border-gray-200">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                          {index === 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              #1
                            </span>
                          )}
                        </div>

                        {/* Additional Information */}
                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                          {item.author && (
                            <div>👤 {item.author}</div>
                          )}
                          <div>💰 ${item.latestPrice?.toFixed(0) || 'N/A'}</div>
                          <div>🗓️ Peak: Day {item.peakDay} ({item.peakDaySales} sales)</div>
                          <div className={`${getGrowthColor(item.growth)}`}>
                            📊 Growth: {item.growth > 0 ? '+' : ''}{item.growth.toFixed(1)}%
                          </div>
                          {item.lastScanned && (
                            <div>🕐 Last: {new Date(item.lastScanned).toLocaleString('en-US', {
                              timeZone: 'Asia/Bangkok',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</div>
                          )}
                        </div>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 mt-2"
                        >
                          View Item →
                        </a>
                      </div>
                    </td>

                    {/* Total Sales Column */}
                    <td className="px-4 py-4 text-center bg-blue-50">
                      <span className="text-sm font-bold text-green-600">
                        {formatNumber(item.totalMonthlySales)}
                      </span>
                    </td>

                    {/* 12 Month Columns */}
                    {monthlySales.map((sales, monthIndex) => {
                      const intensity = maxMonthlySales > 0 ? (sales / maxMonthlySales) : 0;
                      const bgColor = sales > 0 ? `rgba(147, 51, 234, ${0.1 + intensity * 0.8})` : 'transparent';
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                      return (
                        <td
                          key={monthIndex}
                          className="px-3 py-4 text-center"
                          title={`${monthNames[monthIndex]}: ${sales} sales`}
                        >
                          <div
                            className="h-12 w-full rounded flex items-center justify-center text-xs font-medium"
                            style={{ backgroundColor: bgColor }}
                          >
                            {sales > 0 && (
                              <span className={intensity > 0.5 ? 'text-white' : 'text-gray-700'}>
                                {sales}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>💡 <strong>Legend:</strong></span>
            <span>Darker purple = More sales in that month</span>
            <span>Months ordered Jan-Dec</span>
            <span>• Sales shown in {getMonthTitle()} column</span>
          </div>
          <div className="text-xs text-gray-500">
            Hover over month cells for details • Navigate to view different months
          </div>
        </div>
      </div>
    </div>
  );
}
