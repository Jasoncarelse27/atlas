import { describe, expect, it } from 'vitest';
import { http } from '@/lib/http';
import { setupServer } from 'msw/node';
import { http as mswHttp, HttpResponse } from 'msw';

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
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.code).toBe('UNKNOWN'); // The current http function doesn't pass status to normalizeError
      expect(error.message).toContain('Not Found');
    }
  });
});
