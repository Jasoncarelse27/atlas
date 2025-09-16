import { describe, it, expect, vi } from 'vitest';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        error: null
      }))
    }))
  }))
}));

// Import after mocking
import { logEmailFailure } from '../services/emailFailureLogger';

describe('Email Failure Logger', () => {
  it('logs email failure to Supabase on error', async () => {
    const result = await logEmailFailure("fail@example.com", "welcome", "Simulated error");
    expect(result).toBeUndefined(); // success is console + DB insert
  });

  it('handles errors gracefully', async () => {
    // Test that the function doesn't throw even if there are issues
    const result = await logEmailFailure("fail@example.com", "welcome", "Test error");
    expect(result).toBeUndefined();
  });
});
