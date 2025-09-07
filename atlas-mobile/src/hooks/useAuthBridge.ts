import { isAuthBypass, getBypassUser } from '@/lib/devAuth';

// Use this hook everywhere instead of importing the Supabase hook directly.
// If bypass is ON, we return a fake user; otherwise we delegate to the real hook.
export function useAuth() {
  if (isAuthBypass) {
    const user = getBypassUser();
    return { user, isAuthenticated: !!user, isLoading: false, signIn: async () => {}, signOut: async () => {} };
  }
  try {
    // Your existing, real hook (create src/hooks/useAuth.supabase.ts later in Step 2)
    // export function useAuth(){ ... }  // should return { user, isAuthenticated, isLoading, signIn, signOut }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const real = require('./useAuth.supabase');
    return real.useAuth();
  } catch {
    // If the real hook doesn't exist yet, stay unauthenticated (dev can toggle bypass)
    return { user: null, isAuthenticated: false, isLoading: false, signIn: async () => {}, signOut: async () => {} };
  }
}
