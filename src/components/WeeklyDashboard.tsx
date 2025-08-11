'use client';

import { useState, useEffect, useCallback } from 'react';

interface DailyBreakdown {
  day: number; // 0=Sunday, 1=Monday, ... 6=Saturday
  dayName: string;
  sales: number;
}

interface WeeklyItemData {
  id: string;
  name: string;
  url: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  dailyBreakdown: DailyBreakdown[]; // 7 days (Sun-Sat)
  totalWeeklySales: number;
  peakDay: number; // Day with most sales (0-6)
  peakDaySales: number;
  growth: number;
}

interface WeeklyDashboardProps {
  days?: number;
}

export function WeeklyDashboard({ days = 90 }: WeeklyDashboardProps) {
  const [items, setItems] = useState<WeeklyItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(days);

  const fetchWeeklyData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/weekly?days=${selectedDays}`);
      if (!response.ok) {
        throw new Error('Failed to fetch weekly analytics');
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
    fetchWeeklyData();
  }, [fetchWeeklyData]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getDayNames = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getMostActiveDay = (items: WeeklyItemData[]) => {
    const dayTotals = new Array(7).fill(0);
    items.forEach(item => {
      item.dailyBreakdown.forEach(dayData => {
        dayTotals[dayData.day] += dayData.sales;
      });
    });
    
    const maxSales = Math.max(...dayTotals);
    const mostActiveDay = dayTotals.indexOf(maxSales);
    return getDayNames()[mostActiveDay];
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg">Loading daily breakdown...</div>
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

  const sortedItems = [...items].sort((a, b) => b.totalWeeklySales - a.totalWeeklySales);

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weekly Sales Analytics</h2>
          <p className="text-gray-600">7-day sales breakdown for weekly pattern analysis</p>
        </div>
        <div className="flex gap-2">
          {[30, 60, 90, 180].map(dayOption => (
            <button
              key={dayOption}
              onClick={() => setSelectedDays(dayOption)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedDays === dayOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dayOption}D
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Weekly Sales</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(items.reduce((sum, item) => sum + item.totalWeeklySales, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Peak Day</h3>
          <p className="text-2xl font-bold text-blue-600">
            {getMostActiveDay(items)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Weekly Leader</h3>
          <p className="text-lg font-bold text-gray-900">
            {sortedItems[0]?.name || 'N/A'}
          </p>
        </div>
      </div>

      {/* Weekly Analytics Table */}
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
                {/* 7 Day Columns (Mon-Sun) */}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, index) => (
                  <th 
                    key={index} 
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]"
                    title={`${dayName} sales`}
                  >
                    {dayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedItems.map((item, index) => {
                // Create array with sales for each day (Mon=1, Tue=2, ..., Sun=0)
                // Reorder to Mon-Sun display order
                const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
                const dailySales = new Array(7).fill(0);
                
                item.dailyBreakdown.forEach(dayData => {
                  const displayIndex = dayOrder.indexOf(dayData.day);
                  if (displayIndex !== -1) {
                    dailySales[displayIndex] = dayData.sales;
                  }
                });
                
                const maxDailySales = Math.max(...dailySales);
                
                return (
                  <tr key={item.id} className={index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                    {/* Item Column - Sticky */}
                    <td className="sticky left-0 bg-white px-6 py-4 border-r border-gray-200">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                          {index === 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
                          <div>📅 Peak: {getDayNames()[item.peakDay]} ({item.peakDaySales} sales)</div>
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
                        {formatNumber(item.totalWeeklySales)}
                      </span>
                    </td>
                    
                    {/* 7 Day Columns */}
                    {dailySales.map((sales, dayIndex) => {
                      const intensity = maxDailySales > 0 ? (sales / maxDailySales) : 0;
                      const bgColor = sales > 0 ? `rgba(59, 130, 246, ${0.1 + intensity * 0.8})` : 'transparent';
                      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      
                      return (
                        <td 
                          key={dayIndex} 
                          className="px-4 py-4 text-center"
                          title={`${dayNames[dayIndex]}: ${sales} sales`}
                        >
                          <div 
                            className="h-10 w-full rounded flex items-center justify-center text-xs font-medium"
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
            <span>Darker blue = More sales on that day</span>
            <span>Days ordered Mon-Sun</span>
          </div>
          <div className="text-xs text-gray-500">
            Hover over day cells for details • Data from last {selectedDays} days
          </div>
        </div>
      </div>
    </div>
  );
}