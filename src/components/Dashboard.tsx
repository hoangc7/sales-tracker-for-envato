'use client';

import { useState, useEffect, useCallback } from 'react';
import { ItemTable } from './ItemTable';
import { ItemCard } from './ItemCard';
import { ViewToggle } from './ViewToggle';
import { DashboardNavigation, DashboardView } from './DashboardNavigation';
import { DailyDashboard } from './DailyDashboard';
import { WeeklyDashboard } from './WeeklyDashboard';
import { MonthlyDashboard } from './MonthlyDashboard';
import { ScanButton } from './ScanButton';

type ViewMode = 'table' | 'cards';

interface ItemData {
  id: string;
  name: string;
  url: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  weeklySales: number;
  dailySales: Array<{
    date: string;
    dailySales: number;
    totalSales: number;
  }>;
}

export function Dashboard() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [dashboardView, setDashboardView] = useState<DashboardView>('overview');
  const [autoScanning, setAutoScanning] = useState(false);

  const performScan = async () => {
    try {
      setAutoScanning(true);
      const response = await fetch('/api/scan', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Scan failed');
      }
    } catch (error) {
      console.error('Auto-scan failed:', error);
      setError(`Auto-scan failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      setAutoScanning(false);
    }
  };

  const shouldAutoScan = (data: ItemData[]) => {
    // Trigger auto-scan if:
    // 1. No items found
    // 2. No item has been scanned (all lastScanned are null/undefined)
    // 3. All items are older than 24 hours
    if (data.length === 0) return true;
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return data.every(item => {
      if (!item.lastScanned) return true;
      const lastScannedDate = new Date(item.lastScanned);
      return lastScannedDate < oneDayAgo;
    });
  };

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/items');
      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }
      const data = await response.json();
      
      // Handle API error response
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Check if we need to auto-scan
      if (shouldAutoScan(data)) {
        await performScan();
        // Fetch items again after scanning
        const updatedResponse = await fetch('/api/items');
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          setItems(updatedData);
        } else {
          setItems(data);
        }
      } else {
        setItems(data);
      }
      
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">
            {autoScanning ? 'Scanning for latest data...' : 'Loading...'}
          </div>
          {autoScanning && (
            <div className="text-sm text-gray-600 mt-2">
              This may take a few moments as we fetch the latest sales data
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  const renderDashboardContent = () => {
    switch (dashboardView) {
      case 'daily':
        return <DailyDashboard />;
      case 'weekly':
        return <WeeklyDashboard />;
      case 'monthly':
        return <MonthlyDashboard />;
      case 'overview':
      default:
        return (
          <div className="space-y-8">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
                <p className="text-gray-600 mt-2">General comparison and current status</p>
                {items.length > 0 && viewMode === 'table' && (
                  <p className="text-sm text-gray-500 mt-1">
                    First item is used as reference for comparison
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {items.length > 0 && (
                  <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
                )}
              </div>
            </div>

            {viewMode === 'table' ? (
              <ItemTable items={items} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ThemeForest Sales Tracker</h1>
              <p className="text-gray-600 mt-2">Comprehensive sales analytics and monitoring</p>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <ScanButton onScanComplete={fetchItems} />
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <DashboardNavigation 
        currentView={dashboardView} 
        onViewChange={setDashboardView}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {renderDashboardContent()}
      </div>
    </div>
  );
}