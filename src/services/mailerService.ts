// Environment-based service selection
import { mailerService as mockService } from "./mailerService.mock";
import { mailerService as realService } from "./mailerService.real";
import * as Templates from "./emailTemplates";

const useMock =
  process.env.NODE_ENV === "test" || process.env.USE_MOCK_MAILER === "true";

const baseService = useMock ? mockService : realService;

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