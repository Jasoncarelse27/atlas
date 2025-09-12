import { supabase } from "@/lib/supabase";
import { useMessageStore, type Message } from "@/stores/useMessageStore";
import { useEffect, useState } from "react";

import { logger } from '../utils/logger';
export function useSupabaseMessages() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setMessages, addMessage } = useMessageStore();

  useEffect(() => {
    let mounted = true;

    const fetchInitialMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        if (mounted) {
          // Convert Supabase format to store format
          const messages: Message[] = (data || []).map((_msg: unknown) => ({
            id: msg.id,
            type: msg.type || 'TEXT',
            content: msg.content,
            sender: msg.sender || 'user',
            created_at: msg.created_at,
          }));

          setMessages(messages);
          logger.info('✅ Initial messages loaded from Supabase:', messages.length);
        }
      } catch (err) {
        logger.error('❌ Failed to load initial messages:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load messages');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const setupRealtimeSubscription = () => {
      const channel = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            logger.info('🔄 New message received via realtime:', payload);
            
            // Convert Supabase format to store format
            const newMessage: Message = {
              id: payload.new.id,
              type: payload.new.type || 'TEXT',
              content: payload.new.content,
              sender: payload.new.sender || 'user',
              created_at: payload.new.created_at,
            };

            addMessage(newMessage);
          }
        )
        .subscribe();

      return channel;
    };

    // Fetch initial messages
    fetchInitialMessages();

    // Setup realtime subscription
    const channel = setupRealtimeSubscription();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [setMessages, addMessage]);

  return { loading, error };
}
