import { vi } from 'vitest'

// Mock Supabase client for tests
export const mockSupabase = {
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
        user: { id: 'test-user-id' }
      },
      error: null
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn()
        }
      }
    })
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { tier: 'free', status: 'active' },
            error: null
          })
        }),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { tier: 'free', status: 'active' },
          error: null
        })
      }),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'test-id' },
          error: null
        })
      })
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    })
  }),
  functions: {
    invoke: vi.fn().mockResolvedValue({
      data: null,
      error: null
    })
  }
}

// Mock the Supabase client module
vi.mock('../lib/supabaseClient', () => ({
  supabase: mockSupabase,
  default: mockSupabase
}))

export default mockSupabase
