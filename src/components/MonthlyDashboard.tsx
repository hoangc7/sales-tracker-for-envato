'use client';

import { useState, useEffect, useCallback } from 'react';

interface MonthlyBreakdown {
  month: number; // 0=January, 1=February, ... 11=December
  monthName: string;
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
  monthlyBreakdown: MonthlyBreakdown[]; // 12 months (Jan-Dec)
  totalMonthlySales: number;
  peakMonth: number; // Month with most sales (0-11)
  peakMonthSales: number;
  growth: number;
}

interface MonthlyDashboardProps {
  days?: number;
}

export function MonthlyDashboard({ days = 365 }: MonthlyDashboardProps) {
  const [items, setItems] = useState<MonthlyItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(days);

  const fetchMonthlyData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/monthly?days=${selectedDays}`);
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
  }, [selectedDays]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getMonthNames = () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getMostActiveMonth = (items: MonthlyItemData[]) => {
    const monthTotals = new Array(12).fill(0);
    items.forEach(item => {
      item.monthlyBreakdown.forEach(monthData => {
        monthTotals[monthData.month] += monthData.sales;
      });
    });
    
    const maxSales = Math.max(...monthTotals);
    const mostActiveMonth = monthTotals.indexOf(maxSales);
    return getMonthNames()[mostActiveMonth];
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

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
      {/* Header with filters */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monthly Sales Analytics</h2>
          <p className="text-gray-600">12-month sales breakdown for seasonal pattern analysis</p>
        </div>
        <div className="flex gap-2">
          {[90, 180, 365, 730].map(dayOption => (
            <button
              key={dayOption}
              onClick={() => setSelectedDays(dayOption)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedDays === dayOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dayOption < 365 ? `${dayOption}D` : `${Math.round(dayOption/365)}Y`}
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
          <h3 className="text-sm font-medium text-gray-500">Total Annual Sales</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(items.reduce((sum, item) => sum + item.totalMonthlySales, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Peak Season</h3>
          <p className="text-2xl font-bold text-blue-600">
            {getMostActiveMonth(items)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Annual Champion</h3>
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
                {getMonthNames().map((monthName, index) => (
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
                // Create array with sales for each month (0=Jan, 1=Feb, ..., 11=Dec)
                const monthlySales = new Array(12).fill(0);
                item.monthlyBreakdown.forEach(monthData => {
                  monthlySales[monthData.month] = monthData.sales;
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
                          <div>🗓️ Peak: {getMonthNames()[item.peakMonth]} ({item.peakMonthSales} sales)</div>
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
                      const monthNames = getMonthNames();
                      
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
          </div>
          <div className="text-xs text-gray-500">
            Hover over month cells for details • Data from last {selectedDays} days
          </div>
        </div>
      </div>
    </div>
  );
}