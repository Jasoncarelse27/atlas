import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMessageStore, Message } from '@/stores/useMessageStore';

export function useSupabaseMessages() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setMessages, addMessage } = useMessageStore();

  useEffect(() => {
    let mounted = true;

    const fetchInitialMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        if (mounted) {
          // Convert Supabase format to store format
          const messages: Message[] = (data || []).map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.created_at,
          }));

          setMessages(messages);
          console.log('✅ Initial messages loaded from Supabase:', messages);
        }
      } catch (err) {
        console.error('❌ Failed to load initial messages:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load messages');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
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
            console.log('🔄 New message received via realtime:', payload);
            
            // Convert Supabase format to store format
            const newMessage: Message = {
              id: payload.new.id,
              role: payload.new.role,
              content: payload.new.content,
              createdAt: payload.new.created_at,
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

  return { isLoading, error };
}
