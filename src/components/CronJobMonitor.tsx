'use client';

import { useState, useEffect } from 'react';

interface ScanHistory {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  itemsScanned?: number;
  error?: string;
}

interface CronJobStatus {
  status: string;
  timestamp: string;
  currentStatus: {
    isRunning: boolean;
    runningScan?: {
      id: string;
      startedAt: string;
      duration: string;
    };
  };
  lastSuccessfulScan?: {
    id: string;
    completedAt?: string;
    itemsScanned?: number;
  };
  statistics: {
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    successRate: number;
  };
  recentScans: ScanHistory[];
}

export default function CronJobMonitor() {
  const [status, setStatus] = useState<CronJobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scan/status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'RUNNING': return 'text-blue-600 bg-blue-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Cron Job Monitor</h3>
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchStatus}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Cron Job Monitor</h3>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              status.currentStatus.isRunning ? 'bg-blue-500' : 'bg-green-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {status.currentStatus.isRunning ? 'Running' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Status */}
      {status.currentStatus.isRunning && status.currentStatus.runningScan && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Currently Running</h4>
          <div className="text-sm text-blue-700">
            <p>Scan ID: {status.currentStatus.runningScan.id}</p>
            <p>Started: {new Date(status.currentStatus.runningScan.startedAt).toLocaleString()}</p>
            <p>Duration: {status.currentStatus.runningScan.duration}</p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{status.statistics.totalScans}</div>
          <div className="text-sm text-gray-600">Total Scans</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-900">{status.statistics.successfulScans}</div>
          <div className="text-sm text-green-600">Successful</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-900">{status.statistics.failedScans}</div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-900">{status.statistics.successRate}%</div>
          <div className="text-sm text-blue-600">Success Rate</div>
        </div>
      </div>

      {/* Last Successful Scan */}
      {status.lastSuccessfulScan && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Last Successful Scan</h4>
          <div className="text-sm text-green-700">
            <p>Scan ID: {status.lastSuccessfulScan.id}</p>
            <p>Completed: {status.lastSuccessfulScan.completedAt ?
              new Date(status.lastSuccessfulScan.completedAt).toLocaleString() : 'N/A'}</p>
            <p>Items Scanned: {status.lastSuccessfulScan.itemsScanned || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Recent Scans</h4>
        <div className="space-y-2">
          {status.recentScans.slice(0, 10).map((scan) => (
            <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(scan.status)}`}>
                  {scan.status}
                </span>
                <span className="text-sm text-gray-600">
                  {new Date(scan.startedAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {scan.status === 'RUNNING' && (
                  <span>Running for {formatDuration(scan.startedAt)}</span>
                )}
                {scan.status === 'COMPLETED' && scan.itemsScanned && (
                  <span>{scan.itemsScanned} items</span>
                )}
                {scan.status === 'FAILED' && scan.error && (
                  <span className="text-red-600">{scan.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Last updated: {new Date(status.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
