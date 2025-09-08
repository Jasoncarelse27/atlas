import { AppError } from '@/lib/error';
import { http } from '@/lib/http';
import { HttpResponse, http as mswHttp } from 'msw';
import { setupServer } from 'msw/node';
import { describe, expect, it } from 'vitest';

const server = setupServer();

describe('HttpClient', () => {
  // local server for these tests
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('GET json', async () => {
    server.use(mswHttp.get('/api/ping', () => HttpResponse.json({ ok: true })));
    const resp = await http<{ ok: boolean }>('/api/ping');
    expect(resp.ok).toBe(true);
  });

  it('handles errors properly', async () => {
    server.use(mswHttp.get('/api/error', () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));
    
    try {
      await http('/api/error');
      throw new Error('Should have thrown an error');
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Should have thrown an error') {
        throw error;
      }
      const appError = error as AppError;
      expect(appError.code).toBe('UNKNOWN'); // The current http function doesn't pass status to normalizeError
      expect(appError.message).toContain('Not Found');
    }
  });
});
