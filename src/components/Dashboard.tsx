'use client';

import { useState, useEffect } from 'react';
import { ItemTable } from './ItemTable';
import { ItemCard } from './ItemCard';
import { ScanButton } from './ScanButton';
import { ViewToggle } from './ViewToggle';

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

  const fetchItems = async () => {
    try {
      setLoading(true);
      console.log('Fetching items from /api/items');
      const response = await fetch('/api/items');
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received data:', data);
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">ThemeForest Sales Tracker</h1>
            <p className="text-gray-600 mt-2">Track and monitor your ThemeForest item sales</p>
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
            <ScanButton onScanComplete={fetchItems} />
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
    </div>
  );
}