'use client';

import { useCallback } from 'react';
import { DashboardNavigation } from './DashboardNavigation';
import { ScanButton } from './ScanButton';
import { clearAPICache } from '@/hooks/useCachedAPI';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const handleScanComplete = useCallback(() => {
    // Clear all cached data
    clearAPICache();
    // Reload the page to refresh all dashboards
    window.location.reload();
  }, []);

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
            <div className="flex items-center space-x-4">
              {process.env.NODE_ENV === 'development' && (
                <ScanButton onScanComplete={handleScanComplete} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <DashboardNavigation />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-600">
              © 2025 ThemeForest Sales Tracker. All rights reserved.
            </div>
            <div className="flex items-center space-x-6">
              <a
                href="/scan-history"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Scan History</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


