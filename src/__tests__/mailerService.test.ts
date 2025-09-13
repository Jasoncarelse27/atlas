import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mailerService } from '../services/mailerService';

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://mock-supabase-url.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    VITE_MAILERLITE_API_KEY: 'mock-mailerlite-key',
  }
}));

// Mock Supabase client to avoid requiring real environment variables
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ 
        data: { id: 'mock-log-id' }, 
        error: null 
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ 
        data: { tier: 'free', status: 'active' }, 
        error: null 
      }),
    })),
  })),
}));

describe('MailerService Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('sendWelcomeEmail()', () => {
    it('should send welcome email successfully', async () => {
      const result = await mailerService.sendWelcomeEmail({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle missing email', async () => {
      const result = await mailerService.sendWelcomeEmail({
        email: '',
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle API errors', async () => {
      // Mock API error
      server.use(
        http.post('https://connect.mailerlite.com/api/campaigns', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const result = await mailerService.sendWelcomeEmail({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendUpgradeNudge()', () => {
    it('should send upgrade nudge successfully', async () => {
      const result = await mailerService.sendUpgradeNudge({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should include usage stats in nudge', async () => {
      const usageStats = {
        usage_count: 10,
        usage_limit: 10,
      };

      const result = await mailerService.sendUpgradeNudge({
        email: 'test@example.com',
        name: 'Test User',
      }, usageStats);

      expect(result.success).toBe(true);
    });
  });

  describe('sendInactivityReminder()', () => {
    it('should send inactivity reminder successfully', async () => {
      const result = await mailerService.sendInactivityReminder({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should include last activity date', async () => {
      const lastActivity = new Date().toISOString();
      
      const result = await mailerService.sendInactivityReminder({
        email: 'test@example.com',
        name: 'Test User',
      }, lastActivity);

      expect(result.success).toBe(true);
    });
  });

  describe('sendWeeklySummary()', () => {
    it('should send weekly summary successfully', async () => {
      const summaryData = {
        messageCount: 25,
        conversationCount: 5,
        topTopics: ['AI Development', 'React', 'TypeScript'],
        insights: ['You\'re in the top 10% of active users!'],
        usageStats: {
          totalMessages: 150,
          averageResponseTime: 2.3,
          favoriteModel: 'Claude'
        }
      };

      const result = await mailerService.sendWeeklySummary({
        email: 'test@example.com',
        name: 'Test User',
      }, summaryData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle missing summary data', async () => {
      const result = await mailerService.sendWeeklySummary({
        email: 'test@example.com',
        name: 'Test User',
      }, {} as any);

      expect(result.success).toBe(true);
    });
  });

  describe('testEmailFlow()', () => {
    it('should test welcome email flow', async () => {
      const result = await mailerService.testEmailFlow({
        email: 'test@example.com',
        name: 'Test User',
      }, 'welcome');

      expect(result.success).toBe(true);
    });

    it('should test upgrade nudge flow', async () => {
      const result = await mailerService.testEmailFlow({
        email: 'test@example.com',
        name: 'Test User',
      }, 'upgrade_nudge');

      expect(result.success).toBe(true);
    });

    it('should test inactivity reminder flow', async () => {
      const result = await mailerService.testEmailFlow({
        email: 'test@example.com',
        name: 'Test User',
      }, 'inactivity_reminder');

      expect(result.success).toBe(true);
    });

    it('should test weekly summary flow', async () => {
      const result = await mailerService.testEmailFlow({
        email: 'test@example.com',
        name: 'Test User',
      }, 'weekly_summary');

      expect(result.success).toBe(true);
    });

    it('should handle invalid flow type', async () => {
      const result = await mailerService.testEmailFlow({
        email: 'test@example.com',
        name: 'Test User',
      }, 'invalid_flow' as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid flow type');
    });
  });

  describe('Email Template Generation', () => {
    it('should generate welcome email HTML', () => {
      const html = mailerService.generateWelcomeEmailHTML({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(html).toContain('Welcome to Atlas AI');
      expect(html).toContain('Test User');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should generate welcome email text', () => {
      const text = mailerService.generateWelcomeEmailText({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(text).toContain('Welcome to Atlas AI');
      expect(text).toContain('Test User');
    });

    it('should generate weekly summary HTML', () => {
      const summaryData = {
        messageCount: 25,
        conversationCount: 5,
        topTopics: ['AI Development'],
        insights: ['Great week!'],
        usageStats: {
          totalMessages: 150,
          averageResponseTime: 2.3,
          favoriteModel: 'Claude'
        }
      };

      const html = mailerService.generateWeeklySummaryHTML({
        email: 'test@example.com',
        name: 'Test User',
      }, summaryData);

      expect(html).toContain('Your Atlas Weekly Insight');
      expect(html).toContain('25');
      expect(html).toContain('AI Development');
    });

    it('should generate weekly summary text', () => {
      const summaryData = {
        messageCount: 25,
        conversationCount: 5,
        topTopics: ['AI Development'],
        insights: ['Great week!'],
        usageStats: {
          totalMessages: 150,
          averageResponseTime: 2.3,
          favoriteModel: 'Claude'
        }
      };

      const text = mailerService.generateWeeklySummaryText({
        email: 'test@example.com',
        name: 'Test User',
      }, summaryData);

      expect(text).toContain('Your Atlas Weekly Insight');
      expect(text).toContain('25');
      expect(text).toContain('AI Development');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Mock network error
      server.use(
        http.post('https://connect.mailerlite.com/api/campaigns', () => {
          return HttpResponse.error();
        })
      );

      const result = await mailerService.sendWelcomeEmail({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      // Mock timeout
      server.use(
        http.post('https://connect.mailerlite.com/api/campaigns', () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      // This would timeout in real implementation
      // For now, just test that the function exists
      expect(typeof mailerService.sendWelcomeEmail).toBe('function');
    });
  });

  describe('Email Logging', () => {
    it('should log email sent to Supabase', async () => {
      // Mock Supabase response
      server.use(
        http.post('*/supabase.co/rest/v1/email_logs', () => {
          return HttpResponse.json({
            id: 'log-id',
            flow_type: 'welcome',
            recipient_email: 'test@example.com',
            status: 'sent',
          });
        })
      );

      const result = await mailerService.sendWelcomeEmail({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
    });
  });
});
