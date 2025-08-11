'use client';

import { useState, useEffect, useCallback } from 'react';

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
}

interface DailyDashboardProps {
  days?: number;
}

export function DailyDashboard({ days = 30 }: DailyDashboardProps) {
  const [items, setItems] = useState<DailyItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays] = useState(days);

  const fetchDailyData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/daily?days=${selectedDays}`);
      if (!response.ok) {
        throw new Error('Failed to fetch daily analytics');
      }
      const data = await response.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg">Loading hourly breakdown...</div>
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
  const sortedItems = [...items].sort((a, b) => b.totalDailySales - a.totalDailySales);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hourly Sales Analytics</h2>
          <p className="text-gray-600">24-hour sales breakdown for detailed timing analysis</p>
        </div>
        <div className="text-sm text-gray-500">
          Data from last {selectedDays} days
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Daily Sales</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(items.reduce((sum, item) => sum + item.totalDailySales, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Peak Hour (GMT+7)</h3>
          <p className="text-2xl font-bold text-blue-600">
            {formatHour(getMostActiveHour(items))}
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
                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[280px]">
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
                    <td className="sticky left-0 bg-white px-6 py-4 border-r border-gray-200">
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
            <span>Darker green = More sales in that hour</span>
            <span>All times in GMT+7</span>
          </div>
          <div className="text-xs text-gray-500">
            Hover over hour cells for details • Scroll horizontally to see all 24 hours
          </div>
        </div>
      </div>
    </div>
  );
}