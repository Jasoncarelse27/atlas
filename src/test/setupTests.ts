import "@testing-library/jest-dom";
import { vi } from 'vitest';
import { server } from "./testServer";

// MSW (mock server) – start for tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock mailer service
vi.mock('@/services/mailerService', () => ({
  mailerService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'test-msg-123',
      error: undefined,
    }),
    sendUpgradeNudge: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'test-msg-456',
      error: undefined,
    }),
    sendInactivityReminder: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'test-msg-789',
      error: undefined,
    }),
    sendWeeklySummary: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'test-msg-101',
      error: undefined,
    }),
    logEmailSent: vi.fn().mockResolvedValue({ error: null }),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));
