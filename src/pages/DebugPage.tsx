import React from "react";
import UserProfileDebug from "@/components/debug/UserProfileDebug";
import type { User } from "@supabase/supabase-js";

interface DebugPageProps {
  user: User | null;
}

export default function DebugPage({ user }: DebugPageProps) {
  return (
    <main style={{ padding: 20 }}>
      <h2>🔍 Debug Panel</h2>
      <UserProfileDebug user={user} />
    </main>
  );
}
