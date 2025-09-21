import '@testing-library/jest-dom';
import { server } from './mocks/server';
import { vi } from 'vitest';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  },
});

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase with comprehensive chaining support
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => {
    const createChainableMethods = () => ({
      eq: vi.fn(() => createChainableMethods()),
      gt: vi.fn(() => createChainableMethods()),
      lt: vi.fn(() => createChainableMethods()),
      gte: vi.fn(() => createChainableMethods()),
      lte: vi.fn(() => createChainableMethods()),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      order: vi.fn(() => createChainableMethods()),
      limit: vi.fn(() => createChainableMethods()),
    });

    return {
      from: vi.fn(() => ({
        select: vi.fn(() => createChainableMethods()),
        insert: vi.fn(() => ({
          select: vi.fn(() => createChainableMethods()),
          ...createChainableMethods(),
        })),
        update: vi.fn(() => createChainableMethods()),
        delete: vi.fn(() => createChainableMethods()),
        upsert: vi.fn(() => createChainableMethods()),
      })),
      sql: vi.fn(() => Promise.resolve({ data: [], error: null })),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
          download: vi.fn(() => Promise.resolve({ data: null, error: null })),
          remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      },
    };
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Setup MSW server
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});