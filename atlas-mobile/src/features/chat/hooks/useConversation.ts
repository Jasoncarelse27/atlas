import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertUserMessage, listMessages } from '../services/conversationService';

const qk = (id: string) => ['messages', id];

export function useConversation(conversationId: string) {
  const qc = useQueryClient();
  const { data: messages = [] } = useQuery({ queryKey: qk(conversationId), queryFn: () => listMessages(conversationId) });

  const send = useMutation({
    mutationFn: async (text: string) => {
      // Optimistically add user message
      qc.setQueryData<any[]>(qk(conversationId), (prev = []) => [
        ...prev,
        { id: `optimistic:${Date.now()}`, conversation_id: conversationId, role: 'user', content: text },
      ]);
      
      // Save to Supabase
      await insertUserMessage(conversationId, text);
      
      // For now, just add a simple response (we can add streaming later)
      qc.setQueryData<any[]>(qk(conversationId), (prev = []) => [
        ...prev,
        { id: `response:${Date.now()}`, conversation_id: conversationId, role: 'assistant', content: 'Hello! This is a test response from Atlas AI.' },
      ]);
    },
  });

  return { messages, send: (t: string) => send.mutate(t), sending: send.isPending };
}
