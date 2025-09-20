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
    console.log('⏰ Weekly reports cron disabled (NODE_ENV, ENABLE_WEEKLY_REPORTS, or CI)');
    return;
  }

  if (weeklyReportJob) {
    console.log('⏰ Weekly report cron already running');
    return;
  }

  // Schedule for every Monday at 08:00 UTC
  weeklyReportJob = cron.schedule('0 8 * * 1', async () => {
    console.log('⏰ Running weekly report cron job...');
    
    try {
      const result = await generateWeeklyReport();
      
      if (result.success) {
        console.log(`✅ Weekly report completed: ${result.filename}`);
        console.log(`📁 Stored at: ${result.storagePath}`);
        console.log(`📧 Email status: ${result.emailStatus.status}`);
      } else {
        console.error(`❌ Weekly report failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Weekly report cron job error:', error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  weeklyReportJob.start();
  console.log('⏰ Weekly report cron job started (Mondays at 08:00 UTC)');
}

/**
 * Stop weekly report cron job
 */
export function stopWeeklyReportCron() {
  if (weeklyReportJob) {
    weeklyReportJob.stop();
    weeklyReportJob = null;
    console.log('⏰ Weekly report cron job stopped');
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
