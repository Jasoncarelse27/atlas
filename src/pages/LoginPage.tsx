import React from 'react';
import { hasSupabase, supabase } from '@/lib/supabase';

export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  if (!hasSupabase) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Atlas (Dev Mode)</h1>
          <p className="text-sm text-slate-600">
            Supabase is not configured. Continue locally without login.
          </p>
          <button
            className="px-4 py-2 rounded-lg border"
            onClick={() => { localStorage.setItem('atlas_dev_login', '1'); window.location.reload(); }}
          >
            Continue without login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <button
        className="px-4 py-2 rounded-lg border"
        onClick={async () => {
          const { data, error } = await supabase!.auth.signInAnonymously();
          if (!error && data?.user) onLoggedIn();
        }}
      >
        Continue
      </button>
    </div>
  );
}
