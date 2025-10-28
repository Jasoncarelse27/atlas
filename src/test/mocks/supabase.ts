import { vi } from 'vitest'

/**
 * Centralized Supabase Mock
 * 
 * Usage in tests:
 * 
 * import { createMockSupabaseClient, mockSupabase } from '@/test/mocks/supabase';
 * 
 * // Option 1: Use default mock
 * vi.mock('@/lib/supabaseClient', () => ({ supabase: mockSupabase }));
 * 
 * // Option 2: Customize per test
 * const customMock = createMockSupabaseClient({ data: myData, error: null });
 * vi.mock('@/lib/supabaseClient', () => ({ supabase: customMock }));
 */

// Store for dynamic mock data (can be updated per test)
export let mockData: any = null;
export let mockError: any = null;

export const setMockData = (data: any) => { mockData = data; };
export const setMockError = (error: any) => { mockError = error; };
export const resetMocks = () => { 
  mockData = null; 
  mockError = null; 
};

/**
 * Creates a mock Supabase client with full query builder chain support
 */
export const createMockSupabaseClient = () => {
  // Mock chain that dynamically reads mockData/mockError at call time
  const createChain = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    // Terminal methods that dynamically read mockData/mockError
    limit: vi.fn(() => Promise.resolve({ data: mockData, error: mockError })),
    single: vi.fn(() => Promise.resolve({ data: mockData, error: mockError })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: mockData, error: mockError })),
    then: vi.fn((resolve) => resolve({ data: mockData, error: mockError })),
  });

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
            user: { id: 'test-user-id' }
          }
        },
        error: null
      }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: 'test-user-id', email: 'test@example.com' }
        },
        error: null
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null
      }),
    },
    from: vi.fn(() => createChain()),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      }))
    }
  };
};

// Default mock instance
export const mockSupabase = createMockSupabaseClient();

// Mock the Supabase client module by default
vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  default: mockSupabase
}));

export default mockSupabase;
