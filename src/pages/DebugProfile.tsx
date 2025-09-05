import { useUserProfile } from '@/hooks/useUserProfile';
import type { User } from '@supabase/supabase-js';

interface DebugProfileProps {
  user: User | null;
}

const DebugProfile = ({ user }: DebugProfileProps) => {
  const { data, isLoading, error } = useUserProfile(user?.id ?? null)

  if (isLoading) return <p>Loading profile...</p>
  if (error) return <p>Error loading profile: {error.message}</p>

  return (
    <div style={{ padding: '20px' }}>
      <h2>User Profile Debug</h2>
      <div style={{ marginBottom: '20px' }}>
        <strong>User ID:</strong> {user?.id || 'No user ID'}
      </div>
      <div style={{ marginBottom: '20px' }}>
        <strong>Profile Data:</strong>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '10px', 
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '400px'
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default DebugProfile
