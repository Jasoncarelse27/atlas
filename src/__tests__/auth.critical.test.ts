import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
    }))
  }
}));

describe('Authentication Critical Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Authentication', () => {
    it('should handle successful login', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com'
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: {
            access_token: 'test-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: mockUser
          }
        },
        error: null
      });

      const result = await authService.signIn('test@example.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should handle failed login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials', status: 401 }
      });

      const result = await authService.signIn('test@example.com', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle user signup with tier assignment', async () => {
      const mockUser = {
        id: 'new-user-id',
        email: 'newuser@example.com'
      };

      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: null
        },
        error: null
      });

      // Mock profile creation
      const mockProfileInsert = vi.fn().mockResolvedValueOnce({
        data: { id: 'new-user-id', tier: 'free' },
        error: null
      });

      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        insert: mockProfileInsert,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }));

      const result = await authService.signUp('newuser@example.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should validate session tokens', async () => {
      const mockSession = {
        access_token: 'valid-token',
        user: { id: 'test-user-id' }
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: mockSession.user },
        error: null
      });

      const isValid = await authService.validateSession('valid-token');
      expect(isValid).toBe(true);
    });

    it('should reject invalid session tokens', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token', status: 401 }
      });

      const isValid = await authService.validateSession('invalid-token');
      expect(isValid).toBe(false);
    });
  });

  describe('Tier Enforcement', () => {
    it('should fetch user tier from profile', async () => {
      const mockProfile = {
        id: 'test-user-id',
        tier: 'core',
        updated_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockProfile,
          error: null
        })
      }));

      const tier = await authService.getUserTier('test-user-id');
      expect(tier).toBe('core');
    });

    it('should default to free tier if profile not found', async () => {
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Profile not found' }
        })
      }));

      const tier = await authService.getUserTier('test-user-id');
      expect(tier).toBe('free');
    });
  });

  describe('Security', () => {
    it('should not expose service role key in client', () => {
      expect(window.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
      expect(import.meta.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });

    it('should sanitize user input on auth', async () => {
      const maliciousEmail = '<script>alert("xss")</script>@example.com';
      
      await authService.signIn(maliciousEmail, 'password');
      
      // Check that the email was properly sanitized
      const callArgs = vi.mocked(supabase.auth.signInWithPassword).mock.calls[0][0];
      expect(callArgs.email).not.toContain('<script>');
    });
  });
});
