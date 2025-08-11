import * as cron from 'node-cron';
import { ScannerService } from './scanner';

let cronJob: cron.ScheduledTask | null = null;

export function startCronJob() {
  if (cronJob) {
    console.log('Cron job is already running');
    return;
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

  console.log('Cron job started: Hourly scan in GMT+7 timezone');
}

export function stopCronJob() {
  if (cronJob) {
    cronJob.destroy();
    cronJob = null;
    console.log('Cron job stopped');
  }
}