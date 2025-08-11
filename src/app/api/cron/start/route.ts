import { NextResponse } from 'next/server';
import { startCronJob } from '@/lib/cron';

export async function POST() {
  try {
    startCronJob();
    return NextResponse.json({ success: true, message: 'Cron job started' });
  } catch (error) {
    console.error('Failed to start cron job:', error);
    return NextResponse.json({ success: false, error: 'Failed to start cron job' }, { status: 500 });
  }
}