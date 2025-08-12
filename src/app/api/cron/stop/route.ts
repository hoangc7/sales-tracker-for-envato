import { NextResponse } from 'next/server';
import { stopCronJob } from '@/lib/cron';

export async function POST() {
  try {
    stopCronJob();
    return NextResponse.json({ success: true, message: 'Cron job stopped' });
  } catch (error) {
    console.error('Failed to stop cron job:', error);
    return NextResponse.json({ success: false, error: 'Failed to stop cron job' }, { status: 500 });
  }
}