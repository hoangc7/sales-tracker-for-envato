'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useCachedAPI } from '@/hooks/useCachedAPI';

// ── Types ──────────────────────────────────────────────────────────────────

interface ItemData {
  id: string;
  name: string;
  url: string;
  envatoId: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  weeklySales: number;
  dailySales: Array<{ date: string; dailySales: number; totalSales: number }>;
}

interface HourlyBreakdown {
  hour: number;
  sales: number;
}

interface DailyItemData {
  envatoId: string;
  hourlyBreakdown: HourlyBreakdown[];
  totalDailySales: number;
  peakHour: number;
  peakHourSales: number;
  growth: number;
  dayStart: string;
  dayEnd: string;
}

interface WeeklyBreakdown {
  day: number;
  dayName: string;
  sales: number;
}

interface WeeklyItemData {
  envatoId: string;
  dailyBreakdown: WeeklyBreakdown[];
  totalWeeklySales: number;
  peakDay: number;
  peakDaySales: number;
  growth: number;
  weekStart: string;
  weekEnd: string;
}

interface MonthlyBreakdown {
  day: number;
  sales: number;
}

interface MonthlyItemData {
  envatoId: string;
  dailyBreakdown: MonthlyBreakdown[];
  totalMonthlySales: number;
  peakDay: number;
  peakDaySales: number;
  growth: number;
  monthStart: string;
  monthEnd: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const formatNumber = (n: number) => n.toLocaleString();
const formatHour = (h: number) => `${h.toString().padStart(2, '0')}h`;

function getGrowthColor(growth: number) {
  if (growth > 0) return 'text-green-600';
  if (growth < 0) return 'text-red-600';
  return 'text-gray-500';
}

function formatGrowth(growth: number) {
  return `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  onPrev,
  onNext,
  onReset,
  resetLabel,
  canPrev,
  canNext,
}: {
  title: string;
  subtitle: string;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  resetLabel: string;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            !canPrev
              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            !canNext
              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Next →
        </button>
        {!canNext && (
          <span className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-400 cursor-default">
            {resetLabel}
          </span>
        )}
        {canNext && (
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Daily Section ──────────────────────────────────────────────────────────

function DailySection({ envatoId, oldestDate }: { envatoId: string; oldestDate: Date | null }) {
  const [daysAgo, setDaysAgo] = useState(0);

  const { data: allItems, loading } = useCachedAPI<DailyItemData[]>(
    `/api/analytics/daily?daysAgo=${daysAgo}`,
    [daysAgo],
  );

  const item = allItems?.find((i) => i.envatoId === envatoId);

  const canGoToPrev = (() => {
    if (!oldestDate) return true;
    const target = new Date();
    target.setDate(target.getDate() - (daysAgo + 1));
    target.setHours(0, 0, 0, 0);
    return target >= oldestDate;
  })();

  const dayLabel =
    daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} Days Ago`;

  const dateLabel = item?.dayStart
    ? new Date(item.dayStart).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  // Build 24-slot array for the chart
  const chartData = Array.from({ length: 24 }, (_, hour) => ({
    hour: formatHour(hour),
    sales: item?.hourlyBreakdown.find((h) => h.hour === hour)?.sales ?? 0,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <SectionHeader
        title="Daily Breakdown"
        subtitle={`${dayLabel}${dateLabel ? ` · ${dateLabel}` : ''} · Hourly sales (GMT+7)`}
        onPrev={() => setDaysAgo((p) => p + 1)}
        onNext={() => setDaysAgo((p) => Math.max(0, p - 1))}
        onReset={() => setDaysAgo(0)}
        resetLabel="Today"
        canPrev={canGoToPrev}
        canNext={daysAgo > 0}
      />

      {/* Stats row */}
      {item && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 font-medium">Total Sales</p>
            <p className="text-xl font-bold text-green-900">{formatNumber(item.totalDailySales)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Peak Hour</p>
            <p className="text-xl font-bold text-gray-800">
              {formatHour(item.peakHour)}
              <span className="text-sm font-normal text-gray-500 ml-1">({item.peakHourSales})</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Growth</p>
            <p className={`text-xl font-bold ${getGrowthColor(item.growth)}`}>
              {formatGrowth(item.growth)}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2 text-green-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
            <span className="text-sm">Loading hourly data…</span>
          </div>
        </div>
      )}

      {!loading && item && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, 'Sales']}
              labelFormatter={(label) => `Hour ${label} (GMT+7)`}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="sales" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {!loading && !item && (
        <p className="text-center text-gray-400 text-sm py-12">No data for this period.</p>
      )}
    </div>
  );
}

// ── Weekly Section ─────────────────────────────────────────────────────────

function WeeklySection({ envatoId, oldestDate }: { envatoId: string; oldestDate: Date | null }) {
  const [weeksAgo, setWeeksAgo] = useState(0);

  const { data: allItems, loading } = useCachedAPI<WeeklyItemData[]>(
    `/api/analytics/weekly?weeksAgo=${weeksAgo}`,
    [weeksAgo],
  );

  const item = allItems?.find((i) => i.envatoId === envatoId);

  const canGoToPrev = (() => {
    if (!oldestDate) return true;
    const now = new Date();
    const daysToMon = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const targetMon = new Date(now);
    targetMon.setDate(now.getDate() - daysToMon - (weeksAgo + 1) * 7);
    targetMon.setHours(0, 0, 0, 0);
    return targetMon >= oldestDate;
  })();

  const weekLabel =
    weeksAgo === 0 ? 'This Week' : weeksAgo === 1 ? 'Last Week' : `${weeksAgo} Weeks Ago`;

  const weekRange =
    item?.weekStart && item?.weekEnd
      ? (() => {
          const s = new Date(item.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const e = new Date(item.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return `${s} – ${e}`;
        })()
      : '';

  // Mon-Sun display order
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartData = dayNames.map((name, i) => ({
    day: name,
    sales: item?.dailyBreakdown.find((d) => d.day === dayOrder[i])?.sales ?? 0,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <SectionHeader
        title="Weekly Breakdown"
        subtitle={`${weekLabel}${weekRange ? ` · ${weekRange}` : ''}`}
        onPrev={() => setWeeksAgo((p) => p + 1)}
        onNext={() => setWeeksAgo((p) => Math.max(0, p - 1))}
        onReset={() => setWeeksAgo(0)}
        resetLabel="This Week"
        canPrev={canGoToPrev}
        canNext={weeksAgo > 0}
      />

      {item && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">Total Sales</p>
            <p className="text-xl font-bold text-blue-900">{formatNumber(item.totalWeeklySales)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Peak Day</p>
            <p className="text-xl font-bold text-gray-800">
              {dayNames[dayOrder.indexOf(item.peakDay)]}
              <span className="text-sm font-normal text-gray-500 ml-1">({item.peakDaySales})</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Growth</p>
            <p className={`text-xl font-bold ${getGrowthColor(item.growth)}`}>
              {formatGrowth(item.growth)}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            <span className="text-sm">Loading weekly data…</span>
          </div>
        </div>
      )}

      {!loading && item && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, 'Sales']}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {!loading && !item && (
        <p className="text-center text-gray-400 text-sm py-12">No data for this period.</p>
      )}
    </div>
  );
}

// ── Monthly Section ────────────────────────────────────────────────────────

function MonthlySection({ envatoId, oldestDate }: { envatoId: string; oldestDate: Date | null }) {
  const [monthsAgo, setMonthsAgo] = useState(0);

  const { data: allItems, loading } = useCachedAPI<MonthlyItemData[]>(
    `/api/analytics/monthly?monthsAgo=${monthsAgo}`,
    [monthsAgo],
  );

  const item = allItems?.find((i) => i.envatoId === envatoId);

  const canGoToPrev = (() => {
    if (!oldestDate) return true;
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - (monthsAgo + 1), 1);
    return target >= oldestDate;
  })();

  const monthLabel =
    monthsAgo === 0 ? 'This Month' : monthsAgo === 1 ? 'Last Month' : `${monthsAgo} Months Ago`;

  const monthName = item?.monthStart
    ? new Date(item.monthStart).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '';

  // Build day-by-day chart data
  const daysInMonth = item?.monthStart
    ? new Date(new Date(item.monthStart).getFullYear(), new Date(item.monthStart).getMonth() + 1, 0).getDate()
    : 31;

  const chartData = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    sales: item?.dailyBreakdown.find((d) => d.day === i + 1)?.sales ?? 0,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <SectionHeader
        title="Monthly Breakdown"
        subtitle={`${monthLabel}${monthName ? ` · ${monthName}` : ''}`}
        onPrev={() => setMonthsAgo((p) => p + 1)}
        onNext={() => setMonthsAgo((p) => Math.max(0, p - 1))}
        onReset={() => setMonthsAgo(0)}
        resetLabel="This Month"
        canPrev={canGoToPrev}
        canNext={monthsAgo > 0}
      />

      {item && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-purple-600 font-medium">Total Sales</p>
            <p className="text-xl font-bold text-purple-900">{formatNumber(item.totalMonthlySales)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Peak Day</p>
            <p className="text-xl font-bold text-gray-800">
              Day {item.peakDay}
              <span className="text-sm font-normal text-gray-500 ml-1">({item.peakDaySales})</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Growth</p>
            <p className={`text-xl font-bold ${getGrowthColor(item.growth)}`}>
              {formatGrowth(item.growth)}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2 text-purple-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
            <span className="text-sm">Loading monthly data…</span>
          </div>
        </div>
      )}

      {!loading && item && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, 'Sales']}
              labelFormatter={(label) => `Day ${label}`}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="sales" fill="#9333ea" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {!loading && !item && (
        <p className="text-center text-gray-400 text-sm py-12">No data for this period.</p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ItemDetailPage({ envatoId }: { envatoId: string }) {
  const { data: allItems, loading: itemsLoading } = useCachedAPI<ItemData[]>('/api/items');
  const { data: dateRangeData } = useCachedAPI<{ oldestDate?: string }>(
    '/api/analytics/data-range?type=oldest',
  );

  const item = allItems?.find((i) => i.envatoId === envatoId);
  const oldestDate = dateRangeData?.oldestDate ? new Date(dateRangeData.oldestDate) : null;

  const todaySales = item?.dailySales?.[0]?.dailySales ?? 0;

  if (itemsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 px-6 py-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          <span className="text-blue-800 font-medium">Loading item data…</span>
        </div>
      </div>
    );
  }

  if (!item && !itemsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500 text-lg">Item not found.</p>
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Back to all items
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        ← All Items
      </Link>

      {/* Item header */}
      {item && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
                {item.category && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {item.category}
                  </span>
                )}
              </div>
              {item.author && <p className="text-sm text-gray-500">by {item.author}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {item.latestPrice != null && (
                <span className="text-lg font-semibold text-gray-800">
                  ${item.latestPrice.toFixed(2)}
                </span>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
              >
                View on Envato →
              </a>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(item.latestSales)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">This Week</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                +{formatNumber(item.weeklySales)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Today</p>
              <p className="text-2xl font-bold text-green-600 mt-1">+{formatNumber(todaySales)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Last Scanned</p>
              <p className="text-sm font-medium text-gray-700 mt-1">
                {item.lastScanned
                  ? new Date(item.lastScanned).toLocaleString('en-US', {
                      timeZone: 'Asia/Bangkok',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stacked analytics sections */}
      <DailySection envatoId={envatoId} oldestDate={oldestDate} />
      <WeeklySection envatoId={envatoId} oldestDate={oldestDate} />
      <MonthlySection envatoId={envatoId} oldestDate={oldestDate} />
    </div>
  );
}
