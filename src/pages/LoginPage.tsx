import React from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  if (!supabase) {
    // No Supabase configured: allow dev login
    return (
      <div className="h-screen flex items-center justify-center">
        <button className="px-4 py-2 rounded-lg border" onClick={onLoggedIn}>
          Continue (dev)
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <button
        className="px-4 py-2 rounded-lg border"
        onClick={async () => {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (!error && data?.user) onLoggedIn();
        }}
      >
        Continue
      </button>
    </div>
  );
}
