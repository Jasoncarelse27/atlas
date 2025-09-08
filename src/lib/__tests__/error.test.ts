import { AppError, normalizeError, userMessage } from '@/lib/error';
import { describe, expect, it } from 'vitest';

describe('AppError', () => {
  it('wraps unknown error', () => {
    const e = normalizeError('boom');
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe('UNKNOWN');
  });

  it('creates AppError with proper structure', () => {
    const e = new AppError('NETWORK', 'Network error', 500);
    expect(e.message).toBe('Network error');
    expect(e.code).toBe('NETWORK');
    expect(e.status).toBe(500);
  });

  it('userMessage returns friendly messages', () => {
    const networkError = new AppError('NETWORK', 'Network error');
    expect(userMessage(networkError)).toBe('Check your internet connection.');
    
    const serverError = new AppError('SERVER', 'Server error', 500);
    expect(userMessage(serverError)).toBe('Our server had a hiccup. Try again.');
  });
});
