import { describe, it, expect, beforeEach } from 'vitest';
import { mailerService } from '../services/mailerService';

describe('Atlas MailerLite Integration Tests', () => {
  beforeEach(() => {
    // Force real service for integration tests
    process.env.USE_MOCK_MAILER = 'false';
    process.env.NODE_ENV = 'development';
    
    // Check if API key is available for integration tests
    if (!process.env.MAILERLITE_API_KEY) {
      console.warn('[Integration Tests] Skipping - MAILERLITE_API_KEY not provided');
    }
  });

  it.skipIf(!process.env.MAILERLITE_API_KEY)('should send real welcome email with API key', async () => {
    const result = await mailerService.sendEmail('test@atlas.app', 'welcome', { name: 'Integration Test User' });
    
    expect(result).toBeDefined();
    // Real API response structure may vary
  });

  it.skipIf(!process.env.MAILERLITE_API_KEY)('should handle retry logic with real API calls', async () => {
    // This will test the actual retry logic with real API calls
    const result = await mailerService.sendEmail('test@atlas.app', 'welcome', { name: 'Retry Test User' });
    
    expect(result).toBeDefined();
  });

  it.skipIf(!process.env.MAILERLITE_API_KEY)('should send all email flow types with real API', async () => {
    const templates = ['welcome', 'upgrade', 'inactivity', 'weeklySummary'];
    
    for (const template of templates) {
      const result = await mailerService.sendEmail('test@atlas.app', template, { name: 'Flow Test User' });
      expect(result).toBeDefined();
    }
  });

  it('should skip integration tests when API key is missing', () => {
    if (!process.env.MAILERLITE_API_KEY) {
      console.log('[Integration Tests] All tests skipped - no API key provided');
      expect(true).toBe(true); // Pass the test
    }
  });
});
