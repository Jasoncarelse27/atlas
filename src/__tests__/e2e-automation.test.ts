import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mailerService } from '../services/mailerService.mock';
import { retry } from '../utils/retry';

describe('Atlas MailerLite Mock Tests', () => {
  beforeEach(() => {
    // Force mock mode for tests
    process.env.USE_MOCK_MAILER = 'true';
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();
  });

  it('should use mock service in test environment', async () => {
    const result = await mailerService.sendEmail('test@atlas.app', 'welcome', { name: 'Test User' });
    
    expect(result.success).toBe(true);
    expect(result.mock).toBe(true);
  });

  it('should handle all email flow types with mock', async () => {
    const templates = ['welcome', 'upgrade', 'inactivity', 'weeklySummary'];
    
    for (const template of templates) {
      const result = await mailerService.sendEmail('test@atlas.app', template, { name: 'Test User' });
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    }
  });

  it('should validate retry utility works with mock failures', async () => {
    // Test retry utility with a failing function
    let attempts = 0;
    const failingFunction = async () => {
      attempts++;
      throw new Error('Test error');
    };

    try {
      await retry(failingFunction, 2, 100);
    } catch (error) {
      // Should have attempted 3 times (initial + 2 retries)
      expect(attempts).toBe(3);
    }
  });

  it('should log mock email sends correctly', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await mailerService.sendEmail('test@atlas.app', 'welcome', { name: 'Test User' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[MOCK] Email sent to test@atlas.app with template welcome',
      { name: 'Test User' }
    );
    
    consoleSpy.mockRestore();
  });
});
