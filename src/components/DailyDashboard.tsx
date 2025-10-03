'use client';

import { useState } from 'react';
import { useCachedAPI } from '@/hooks/useCachedAPI';

interface HourlyBreakdown {
  hour: number; // 0-23
  sales: number;
}

interface DailyItemData {
  id: string;
  name: string;
  url: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  hourlyBreakdown: HourlyBreakdown[]; // 24 hours (0-23)
  totalDailySales: number;
  peakHour: number; // Hour with most sales (0-23)
  peakHourSales: number;
  growth: number;
  dayStart: string;
  dayEnd: string;
}

export function DailyDashboard() {
  const [daysAgo, setDaysAgo] = useState(0); // 0 = today, 1 = yesterday, etc.

  // Use cached API calls
  const {
    data: items,
    loading,
    error
  } = useCachedAPI<DailyItemData[]>(`/api/analytics/daily?daysAgo=${daysAgo}`, [daysAgo]);

  const {
    data: dateRangeData
  } = useCachedAPI<{oldestDate?: string}>('/api/analytics/data-range?type=oldest');

  // Extract oldest date from cached data
  const oldestDate = dateRangeData?.oldestDate ? new Date(dateRangeData.oldestDate) : null;

  const canGoToPreviousDay = (daysAgoCheck: number): boolean => {
    if (!oldestDate) return true; // If we don't know, allow navigation

    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - (daysAgoCheck + 1));
    targetDate.setHours(0, 0, 0, 0);

    return targetDate >= oldestDate;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const getMostActiveHour = (items: DailyItemData[]) => {
    const hourTotals = new Array(24).fill(0);
    items.forEach(item => {
      item.hourlyBreakdown.forEach(hourData => {
        hourTotals[hourData.hour] += hourData.sales;
      });
    });

    const maxSales = Math.max(...hourTotals);
    const mostActiveHour = hourTotals.indexOf(maxSales);
    return mostActiveHour;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const getDayTitle = () => {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return `${daysAgo} Days Ago`;
  };

  const goToPreviousDay = () => setDaysAgo(prev => prev + 1);
  const goToNextDay = () => setDaysAgo(prev => Math.max(0, prev - 1));
  const goToToday = () => setDaysAgo(0);

  if (loading || !items) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 px-6 py-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <div className="text-lg font-medium text-blue-800">Loading hourly breakdown...</div>
        </div>
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

  // Sort items by total daily sales descending
  const sortedItems = items ? [...items].sort((a, b) => b.totalDailySales - a.totalDailySales) : [];

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Sales Analytics</h2>
          <p className="text-gray-600">
            {getDayTitle()} • {items && items.length > 0 && formatDate(items[0].dayStart)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousDay}
            disabled={!canGoToPreviousDay(daysAgo)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              !canGoToPreviousDay(daysAgo)
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={!canGoToPreviousDay(daysAgo) ? "No older data available" : "Previous day"}
          >
            ← Previous
          </button>
          <button
            onClick={goToNextDay}
            disabled={daysAgo === 0}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              daysAgo === 0
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Next day"
          >
            Next →
          </button>
          {daysAgo > 0 && (
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              title="Go to today"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
          <p className="text-2xl font-bold text-gray-900">{items?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Daily Sales</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(items?.reduce((sum, item) => sum + item.totalDailySales, 0) || 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Peak Hour (GMT+7)</h3>
          <p className="text-2xl font-bold text-blue-600">
            {items && items.length > 0 ? formatHour(getMostActiveHour(items)) : '--:--'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Top Performer</h3>
          <p className="text-lg font-bold text-gray-900">
            {sortedItems[0]?.name || 'N/A'}
          </p>
        </div>
      </div>

      {/* Hourly Analytics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                {/* Item Column */}
                <th className="sticky left-0 bg-gray-50 px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[200px] sm:min-w-[280px]">
                  Item
                </th>
                {/* Total Sales Column */}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 min-w-[100px]">
                  Total
                </th>
                {/* 24 Hour Columns */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <th
                    key={hour}
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[50px]"
                    title={`${formatHour(hour)} GMT+7`}
                  >
                    {hour.toString().padStart(2, '0')}h
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedItems.map((item, index) => {
                // Create array with sales for each hour (0-23)
                const hourlySales = new Array(24).fill(0);
                item.hourlyBreakdown.forEach(hourData => {
                  hourlySales[hourData.hour] = hourData.sales;
                });

                const maxHourlySales = Math.max(...hourlySales);

                return (
                  <tr key={item.id} className={index === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    {/* Item Column - Sticky */}
                    <td className="sticky left-0 bg-white px-3 sm:px-6 py-4 border-r border-gray-200">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                          {index === 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
                          <div>📈 Peak: {formatHour(item.peakHour)} ({item.peakHourSales} sales)</div>
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
                        {formatNumber(item.totalDailySales)}
                      </span>
                    </td>

                    {/* 24 Hour Columns */}
                    {hourlySales.map((sales, hour) => {
                      const intensity = maxHourlySales > 0 ? (sales / maxHourlySales) : 0;
                      const bgColor = sales > 0 ? `rgba(34, 197, 94, ${0.1 + intensity * 0.8})` : 'transparent';

                      return (
                        <td
                          key={hour}
                          className="px-3 py-4 text-center"
                          title={`${formatHour(hour)}: ${sales} sales`}
                        >
                          <div
                            className="h-8 w-full rounded flex items-center justify-center text-xs font-medium"
                            style={{ backgroundColor: bgColor }}
                          >
                            {item.hourlyBreakdown.some(h => h.hour === hour) && (
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
            <span>Darker green = More sales in that hour</span>
            <span>All times in Australia/Melbourne</span>
          </div>
          <div className="text-xs text-gray-500">
            Hover over hour cells for details • Scroll horizontally to see all 24 hours
          </div>
        </div>
      </div>
    </div>
  );
}
