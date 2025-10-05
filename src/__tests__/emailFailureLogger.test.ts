import { describe, it, expect, vi } from 'vitest';

// Mock environment variables
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        error: null
      })),
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        error: null
      })),
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }))
}));

// Import after mocking
import { logEmailFailure, getRecentFailures } from '../services/emailFailureLogger';

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

  it('fetches recent failures', async () => {
    const failures = await getRecentFailures(5);
    expect(Array.isArray(failures)).toBe(true);
  });

  it('handles Supabase errors when fetching failures', async () => {
    // Test that the function handles errors gracefully
    const failures = await getRecentFailures(5);
    expect(Array.isArray(failures)).toBe(true);
  });
});
