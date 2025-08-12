import { NextResponse } from 'next/server';

// Global variable to track cron job status
// Note: This is a simple approach for development. In production, you'd want proper state management
declare global {
  var cronJobStatus: {
    isRunning: boolean;
    startedAt: string | null;
    lastRun: string | null;
  };
}

export async function GET() {
  try {
    // Initialize global status if it doesn't exist
    if (!global.cronJobStatus) {
      global.cronJobStatus = {
        isRunning: false,
        startedAt: null,
        lastRun: null
      };
    }

    return NextResponse.json({
      success: true,
      status: global.cronJobStatus
    });
  } catch (error) {
    console.error('Failed to get cron job status:', error);
    return NextResponse.json({ success: false, error: 'Failed to get cron job status' }, { status: 500 });
  }
}