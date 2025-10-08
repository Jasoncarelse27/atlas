// Atlas Cron Service
// Handles scheduled tasks like weekly reports

import cron from 'node-cron';
import { generateWeeklyReport } from './weeklyReportService.mjs';

let weeklyReportJob = null;

/**
 * Start weekly report cron job
 * Runs every Monday at 08:00 UTC
 */
export function startWeeklyReportCron() {
  // Check if we're in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // Only run in production and when enabled, skip in CI
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_WEEKLY_REPORTS !== 'true' || isCI) {
    return;
  }

  if (weeklyReportJob) {
    return;
  }

  // Schedule for every Monday at 08:00 UTC
  weeklyReportJob = cron.schedule('0 8 * * 1', async () => {
    
    try {
      const result = await generateWeeklyReport();
      
      if (result.success) {
        console.log(`✅ Weekly report completed: ${result.filename}`);
      } else {
      }
    } catch (error) {
    }
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  weeklyReportJob.start();
}

/**
 * Stop weekly report cron job
 */
export function stopWeeklyReportCron() {
  if (weeklyReportJob) {
    weeklyReportJob.stop();
    weeklyReportJob = null;
  }
}

/**
 * Get cron job status
 */
export function getCronStatus() {
  return {
    weeklyReportEnabled: process.env.ENABLE_WEEKLY_REPORTS === 'true',
    weeklyReportRunning: weeklyReportJob ? weeklyReportJob.running : false,
    environment: process.env.NODE_ENV
  };
}

export default {
  startWeeklyReportCron,
  stopWeeklyReportCron,
  getCronStatus
};
