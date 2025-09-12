import "@testing-library/jest-dom";
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { handlers } from './msw/handlers';

// Provide Jest globals for compatibility with tests that still use Jest
global.jest = {
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
  runAllTimers: vi.runAllTimers,
  clearAllTimers: vi.clearAllTimers,
  fn: vi.fn,
  spyOn: vi.spyOn,
  mock: vi.mock,
  unmock: vi.unmock,
  doMock: vi.doMock,
  doUnmock: vi.doUnmock,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  clearAllMocks: vi.clearAllMocks,
  isMockFunction: vi.isMockFunction,
  mocked: vi.mocked,
} as any;

// Polyfill for deprecated url.toJSON() method
if (typeof URL !== 'undefined') {
  // Always add the polyfill, even if it exists, to ensure compatibility
  const originalToJSON = URL.prototype.toJSON;
  URL.prototype.toJSON = function() {
    return this.href;
  };
}

// Polyfill for Blob.text() method in Node.js environment
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// MSW (mock server) – start for tests
const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// === MailerLite axios client mock ===
const mockAxiosCreate = vi.fn(() => ({
  post: vi.fn().mockResolvedValue({
    data: { id: 'test-message-id-123' }
  }),
}));

vi.mock('axios', () => ({
  default: {
    create: mockAxiosCreate,
  },
}));

// === Supabase mock ===
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// === Optional: fetch fallback if mailerService uses fetch directly ===
if (typeof fetch !== 'function') {
  // @ts-expect-error - Global fetch mock for tests
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    // Return a generic 200 OK JSON body that matches a "success" contract
    return new Response(JSON.stringify({ success: true, messageId: 'test-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}
import 'fake-indexeddb/auto'
