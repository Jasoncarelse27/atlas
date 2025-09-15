import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export const useUserProfile = (userId: string | null) => {
  return useQuery({
    queryKey: ['userProfile', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User ID is missing')
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        toast.error('Failed to load profile')
        throw new Error(error.message)
      }

      return data
    },
  })
}