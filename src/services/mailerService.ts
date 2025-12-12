// Environment-based service selection
import { mailerService as mockService } from "./mailerService.mock";
import * as Templates from "./emailTemplates";

// Export MailerLite service (for subscriber management and events)
export { mailerLiteService } from "./mailerLiteService";
export type { MailerLiteEvent, SubscriberData } from "./mailerLiteService";

// ✅ CRITICAL FIX: Prevent Node.js-only imports in browser
// mailerService.real.ts uses node-fetch which cannot run in browser
// Browser should ALWAYS use mockService (realService is backend-only)

// Vite uses import.meta.env in client code (not process.env)
const isTestMode = import.meta.env.MODE === "test";
const useMockEnv = import.meta.env.VITE_USE_MOCK_MAILER === "true";
const isBrowser = typeof window !== "undefined";

// Final decision: browser always uses mock
const useMock = isBrowser || isTestMode || useMockEnv;

// ✅ SAFE: Browser always uses mockService
// Real service is NEVER imported in browser builds to prevent node-fetch bundling
const baseService = mockService;

// Create enhanced mailerService with template helpers and wrapper functions
export const mailerService = {
  ...baseService,
  
  // Template helpers
  generateWelcomeEmailHTML: Templates.generateWelcomeEmailHTML,
  generateWelcomeEmailText: Templates.generateWelcomeEmailText,
  generateWeeklySummaryHTML: Templates.generateWeeklySummaryHTML,
  generateWeeklySummaryText: Templates.generateWeeklySummaryText,
  
  // Wrapper functions for common email flows
  async sendWelcomeEmail(data: { email: string; name: string }) {
    const html = Templates.generateWelcomeEmailHTML(data);
    const text = Templates.generateWelcomeEmailText(data);
    return baseService.sendEmail(data.email, "welcome", { html, text });
  },

  async sendWeeklySummary(data: { email: string; name: string; summaryData?: any }) {
    const html = Templates.generateWeeklySummaryHTML(data, data.summaryData);
    const text = Templates.generateWeeklySummaryText(data, data.summaryData);
    return baseService.sendEmail(data.email, "weekly_summary", { html, text });
  },

  // Additional wrapper functions that tests expect
  async sendUpgradeNudge(data: { email: string; name: string; usageStats?: any }) {
    return baseService.sendEmail(data.email, "upgrade_nudge", { 
      name: data.name, 
      usageStats: data.usageStats 
    });
  },

  async sendInactivityReminder(data: { email: string; name: string; lastActivity?: string }) {
    return baseService.sendEmail(data.email, "inactivity_reminder", { 
      name: data.name, 
      lastActivity: data.lastActivity 
    });
  },

  async testEmailFlow(data: { email: string; name: string; flowType?: string }, flowType?: string) {
    const actualFlowType = flowType || data.flowType || "welcome";
    
    // Validate flow type
    const validFlows = ['welcome', 'upgrade_nudge', 'inactivity_reminder', 'weekly_summary'];
    if (!validFlows.includes(actualFlowType)) {
      return { success: false, error: 'Invalid flow type' };
    }
    
    return baseService.sendEmail(data.email, actualFlowType, { name: data.name });
  }
};

// Re-export template helpers for direct usage
export const {
  generateWelcomeEmailHTML,
  generateWelcomeEmailText,
  generateWeeklySummaryHTML,
  generateWeeklySummaryText,
} = Templates;