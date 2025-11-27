import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabaseClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ CRITICAL FIX: Force refresh session on startup to prevent 401 errors
    const initAuth = async () => {
      try {
        // First, try to get existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // ✅ FIX: If session exists but might be expired, refresh it
        if (session && !sessionError) {
          // --- FIX: Ghost user cleanup ---
          const { data: { user: userData }, error: userError } = await supabase.auth.getUser();
          if (userError || !userData) {
            console.warn('[AuthProvider] 🚨 Ghost/stale session detected — clearing.');
            await supabase.auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }
          
          // Check if token is expired (within 5 minutes of expiry)
          const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
          const now = Date.now();
          const timeUntilExpiry = expiresAt - now;
          
          // If token expires in less than 5 minutes, refresh proactively
          if (timeUntilExpiry < 5 * 60 * 1000) {
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            
            if (!refreshError && refreshedSession) {
              setUser(refreshedSession.user);
              localStorage.setItem("supabase_session", JSON.stringify(refreshedSession));
              setLoading(false);
              return;
            }
          }
          
          // Token is still valid
          setUser(session.user);
          localStorage.setItem("supabase_session", JSON.stringify(session));
        } else if (sessionError) {
          // Session error - clear and require re-login
          logger.warn('[AuthProvider] Session error:', sessionError.message);
          localStorage.removeItem("supabase_session");
          setUser(null);
        } else {
          // No session
          setUser(null);
          localStorage.removeItem("supabase_session");
        }
      } catch (error) {
        logger.error('[AuthProvider] Auth init error:', error);
        setUser(null);
        localStorage.removeItem("supabase_session");
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Keep session refreshed & synced
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        localStorage.setItem("supabase_session", JSON.stringify(session));
      } else {
        localStorage.removeItem("supabase_session");
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
