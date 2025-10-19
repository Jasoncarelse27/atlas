// Atlas Weekly Report Service
// Generates and emails weekly usage reports

import { logger } from '../lib/logger.mjs';
import nodemailer from 'nodemailer';
import { supabase } from '../lib/supabase.js';

/**
 * Generate CSV data for a date range
 */
async function generateReportCSV(startDate, endDate) {
  const { data, error } = await supabase
    .from('tier_usage_snapshots')
    .select(`
      snapshot_date,
      email,
      tier,
      message_count,
      cost_accumulated,
      daily_limit,
      budget_ceiling,
      status,
      created_at
    `)
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: false })
    .order('email', { ascending: true });

  if (error) throw error;

  // Convert to CSV
  const headers = [
    'snapshot_date',
    'email',
    'tier',
    'message_count',
    'cost_accumulated',
    'daily_limit',
    'budget_ceiling',
    'status',
    'created_at'
  ];

  const csvRows = [
    headers.join(','),
    ...(data || []).map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value?.toString() || '';
        return stringValue.includes(',') || stringValue.includes('"') 
          ? `"${stringValue.replace(/"/g, '""')}"` 
          : stringValue;
      }).join(',')
    )
  ];

  return csvRows.join('\n');
}

/**
 * Store CSV report in Supabase Storage
 */
async function storeReportCSV(csv, filename) {
  const { data, error } = await supabase.storage
    .from('reports')
    .upload(`weekly/${filename}`, csv, {
      contentType: 'text/csv',
      upsert: true
    });

  if (error) throw error;
  return data.path;
}

/**
 * Send email with CSV attachment
 */
async function sendReportEmail(csv, filename, startDate, endDate) {
  try {
    if (!process.env.SMTP_HOST) {
      return { status: 'skipped', reason: 'No SMTP config' };
    }

    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const reportTo = (process.env.REPORT_TO || 'jasonc.jpg@gmail.com').split(',').map(e => e.trim());

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: reportTo,
      subject: `Atlas Weekly Usage Report - ${startDate} to ${endDate}`,
      text: `
Atlas Weekly Usage Report

Period: ${startDate} to ${endDate}
Generated: ${new Date().toISOString()}

This report contains tier usage data for all Atlas users during the specified period.
Please find the detailed CSV data attached.

Best regards,
Atlas Reporting System
      `,
      attachments: [{
        filename,
        content: csv,
        contentType: 'text/csv'
      }]
    };

    const info = await transporter.sendMail(mailOptions);
    return { status: 'sent', messageId: info.messageId };
  } catch (error) {
    return { status: 'failed', error: error.message };
  }
}

/**
 * Log report run to database
 */
async function logReportRun(startDate, endDate, storagePath, emailStatus) {
  try {
    const { error } = await supabase
      .from('report_runs')
      .insert({
        period_start: startDate,
        period_end: endDate,
        storage_path: storagePath,
        email_status: emailStatus.status,
        email_details: emailStatus
      });

    if (error) throw error;
  } catch (error) {
    logger.error('[WeeklyReport] Error saving report:', error.message || error);
  }
}

/**
 * Generate and send weekly report
 */
export async function generateWeeklyReport(customStartDate = null, customEndDate = null) {
  try {
    // Calculate last 7 full days (Monday to Sunday)
    const now = new Date();
    const endDate = customEndDate || new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate = customStartDate || new Date(new Date(endDate).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];


    // Generate CSV
    const csv = await generateReportCSV(startDate, endDate);
    const filename = `atlas_weekly_report_${startDate}_to_${endDate}.csv`;

    // Store in Supabase Storage
    const storagePath = await storeReportCSV(csv, filename);

    // Send email
    const emailStatus = await sendReportEmail(csv, filename, startDate, endDate);

    // Log the run
    await logReportRun(startDate, endDate, storagePath, emailStatus);

    return {
      success: true,
      startDate,
      endDate,
      filename,
      storagePath,
      emailStatus,
      recordCount: csv.split('\n').length - 1 // Subtract header row
    };
  } catch (error) {
    
    // Still try to log the failed run
    try {
      await logReportRun(
        customStartDate || 'unknown',
        customEndDate || 'unknown',
        null,
        { status: 'failed', error: error.message }
      );
    } catch (logError) {
      logger.error('[WeeklyReport] Error logging failure:', logError.message || logError);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

export default { generateWeeklyReport };
