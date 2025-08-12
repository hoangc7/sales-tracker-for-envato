import * as cron from 'node-cron';
import { ScannerService } from './scanner';

let cronJob: cron.ScheduledTask | null = null;

// Global status tracking
declare global {
  var cronJobStatus: {
    isRunning: boolean;
    startedAt: string | null;
    lastRun: string | null;
  };
}

export function startCronJob() {
  if (cronJob) {
    console.log('Cron job is already running');
    return;
  }

  // Initialize global status
  if (!global.cronJobStatus) {
    global.cronJobStatus = {
      isRunning: false,
      startedAt: null,
      lastRun: null
    };
  }

  // Run every hour on the hour in GMT+7 timezone
  cronJob = cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const gmt7Time = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok', // GMT+7
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    
    global.cronJobStatus.lastRun = now.toISOString();
    
    console.log(`Starting scheduled hourly scan at ${gmt7Time} GMT+7...`);
    try {
      const scanner = new ScannerService();
      await scanner.scanAllItems();
      console.log('Scheduled hourly scan completed successfully');
    } catch (error) {
      console.error('Scheduled hourly scan failed:', error);
    }
  }, {
    timezone: 'Asia/Bangkok' // GMT+7
  });

  global.cronJobStatus.isRunning = true;
  global.cronJobStatus.startedAt = new Date().toISOString();

  console.log('Cron job started: Hourly scan in GMT+7 timezone');
}

export function stopCronJob() {
  if (cronJob) {
    cronJob.destroy();
    cronJob = null;
    
    if (global.cronJobStatus) {
      global.cronJobStatus.isRunning = false;
    }
    
    console.log('Cron job stopped');
  }
}