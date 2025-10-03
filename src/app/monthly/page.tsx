'use client';

import { MonthlyDashboard } from '@/components/MonthlyDashboard';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function MonthlyPage() {
  return (
    <DashboardLayout>
      <MonthlyDashboard />
    </DashboardLayout>
  );
}


