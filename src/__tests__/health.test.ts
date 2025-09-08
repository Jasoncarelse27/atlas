import { describe, it, expect } from 'vitest';
import { getHealth } from '@/health/health';

describe('health checks', () => {
  it('returns a structured health object without throwing', async () => {
    const h = await getHealth();
    expect(h).toHaveProperty('ok');
    expect(h).toHaveProperty('timestamp');
    expect(h).toHaveProperty('checks.dexie');
    expect(h).toHaveProperty('checks.supabaseRealtime');
    expect(h).toHaveProperty('checks.emailAdapter');
  });
});
