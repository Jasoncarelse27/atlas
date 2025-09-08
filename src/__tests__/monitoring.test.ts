import { describe, it, expect } from 'vitest';
import { log, breadcrumb } from '@/monitoring/monitoring';

describe('monitoring shim', () => {
  it('is callable in dev without Sentry', () => {
    expect(() => log('info', 'hello', { a: 1 })).not.toThrow();
    expect(() => breadcrumb({ category: 'test', message: 'm' })).not.toThrow();
  });
});
