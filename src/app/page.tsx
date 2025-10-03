'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ItemTable } from '@/components/ItemTable';
import { ItemCard } from '@/components/ItemCard';
import { ViewToggle } from '@/components/ViewToggle';
import { useCachedAPI, clearCacheForURL } from '@/hooks/useCachedAPI';

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

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [autoScanning, setAutoScanning] = useState(false);
  const hasCheckedAutoScan = useRef(false);

  // Use cached API for items
  const { 
    data: items, 
    loading, 
    error: apiError,
    refresh 
  } = useCachedAPI<ItemData[]>('/api/items', []);

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
      
      // Clear cache and refresh data after scan
      clearCacheForURL('/api/items');
      refresh();
    } catch (error) {
      console.error('Auto-scan failed:', error);
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

  // Check for auto-scan only once when data first loads
  useEffect(() => {
    if (!loading && items && !hasCheckedAutoScan.current) {
      hasCheckedAutoScan.current = true;
      if (shouldAutoScan(items)) {
        performScan();
      }
    }
  }, [loading, items]);

  if (loading || !items) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-4 px-8 py-6 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-900">
              {autoScanning ? 'Scanning for latest data...' : 'Loading dashboard...'}
            </div>
            {autoScanning && (
              <div className="text-sm text-gray-600 mt-2">
                This may take a few moments as we fetch the latest sales data
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {apiError}</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
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
    </DashboardLayout>
  );
}
