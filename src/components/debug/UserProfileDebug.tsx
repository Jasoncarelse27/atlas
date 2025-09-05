import { useUserProfile } from "@/hooks/useUserProfile";
import type { User } from "@supabase/supabase-js";

interface UserProfileDebugProps {
  user: User | null;
}

export default function UserProfileDebug({ user }: UserProfileDebugProps) {
  const userId = user?.id;
  const { data, isLoading, error } = useUserProfile(userId);

  if (isLoading) return <p>🔄 Loading user profile…</p>;
  if (error) return <p style={{ color: "red" }}>❌ {error.message}</p>;

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: 8 }}>
      <h3>User Profile</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
