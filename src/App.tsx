import React, { useEffect, useState } from 'react';
import AtlasChatPage from '@/pages/AtlasChatPage';
import LoginPage from '@/pages/LoginPage';
import { supabase } from '@/lib/supabase';

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady(true); setAuthed(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => { sub?.subscription?.unsubscribe(); };
  }, []);

  if (!ready) return null;
  if (!authed) return <LoginPage onLoggedIn={() => setAuthed(true)} />;
  return <AtlasChatPage />;
}