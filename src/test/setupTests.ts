import "@testing-library/jest-dom";
import { vi } from 'vitest';
import { server } from "./testServer";

// MSW (mock server) – start for tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
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
  // @ts-ignore
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    // Return a generic 200 OK JSON body that matches a "success" contract
    return new Response(JSON.stringify({ success: true, messageId: 'test-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}
