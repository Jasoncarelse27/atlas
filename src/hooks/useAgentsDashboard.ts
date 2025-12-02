// Atlas Agents Dashboard Hooks
// React Query hooks for Agents Dashboard
// Handles notifications, business notes, and business chat

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import {
  getNotifications,
  markNotificationRead,
  getBusinessNotes,
  createBusinessNote,
  businessChat,
  type Notification,
  type BusinessNote,
  type BusinessChatResponse
} from '../services/agentsService';

/**
 * React Query hook for notifications
 * Cache: 5 minutes stale, 10 minutes cache
 */
export function useNotifications() {
  return useQuery<Notification[], Error>({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    onError: (error) => {
      logger.error('[useNotifications] Query error:', error);
      toast.error('Failed to load notifications');
    },
    onSuccess: (data) => {
      logger.debug('[useNotifications] ✅ Notifications loaded:', {
        count: data.length,
        unread: data.filter(n => !n.is_read).length
      });
    }
  });
}

/**
 * React Query hook for business notes
 * Cache: 5 minutes stale, 10 minutes cache
 */
export function useBusinessNotes() {
  return useQuery<BusinessNote[], Error>({
    queryKey: ['business-notes'],
    queryFn: getBusinessNotes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    onError: (error) => {
      logger.error('[useBusinessNotes] Query error:', error);
      toast.error('Failed to load business notes');
    },
    onSuccess: (data) => {
      logger.debug('[useBusinessNotes] ✅ Business notes loaded:', {
        count: data.length
      });
    }
  });
}

/**
 * Mutation hook for creating business notes
 * Invalidates business-notes query on success
 */
export function useCreateBusinessNote() {
  const queryClient = useQueryClient();

  return useMutation<BusinessNote, Error, string>({
    mutationFn: createBusinessNote,
    onSuccess: () => {
      // Invalidate and refetch business notes
      queryClient.invalidateQueries({ queryKey: ['business-notes'] });
      toast.success('Note saved');
    },
    onError: (error) => {
      logger.error('[useCreateBusinessNote] Mutation error:', error);
      toast.error('Failed to save note');
    }
  });
}

/**
 * Mutation hook for marking notification as read
 * Invalidates notifications query on success
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      logger.error('[useMarkNotificationRead] Mutation error:', error);
      toast.error('Failed to mark notification as read');
    }
  });
}

/**
 * Mutation hook for business chat (memory-aware LLM)
 * Optional: for future use
 */
export function useBusinessChat() {
  const queryClient = useQueryClient();

  return useMutation<BusinessChatResponse, Error, string>({
    mutationFn: businessChat,
    onSuccess: () => {
      // Invalidate business notes since chat creates a note
      queryClient.invalidateQueries({ queryKey: ['business-notes'] });
    },
    onError: (error) => {
      logger.error('[useBusinessChat] Mutation error:', error);
      toast.error('Failed to generate response');
    }
  });
}

