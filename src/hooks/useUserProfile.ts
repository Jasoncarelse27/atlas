import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { subscriptionApi } from '../services/subscriptionApi'

export const useUserProfile = (userId: string | null) => {
  return useQuery({
    queryKey: ['userProfile', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User ID is missing')
      
      try {
        // Get access token for backend API calls
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        
        if (!accessToken) {
          throw new Error('No access token available');
        }

        // Use subscription API instead of direct Supabase call
        const profile = await subscriptionApi.getUserProfile(userId, accessToken);
        
        if (!profile) {
          toast.error('Failed to load profile')
          throw new Error('Profile not found')
        }

        return profile
      } catch (error) {
        toast.error('Failed to load profile')
        throw error
      }
    },
  })
}