import * as cron from 'node-cron';
import { ScannerService } from './scanner';

let cronJob: cron.ScheduledTask | null = null;

export function startCronJob() {
  if (cronJob) {
    console.log('Cron job is already running');
    return;
  }

  cronJob = cron.schedule('0 0 * * *', async () => {
    console.log('Starting scheduled scan at midnight...');
    try {
      const scanner = new ScannerService();
      await scanner.scanAllItems();
      console.log('Scheduled scan completed successfully');
    } catch (error) {
      console.error('Scheduled scan failed:', error);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('Cron job started: Daily scan at midnight UTC');
}

export function stopCronJob() {
  if (cronJob) {
    cronJob.destroy();
    cronJob = null;
    console.log('Cron job stopped');
  }
}