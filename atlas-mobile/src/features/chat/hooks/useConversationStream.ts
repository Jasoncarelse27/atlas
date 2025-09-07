import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';

type StreamArgs = { conversationId: string; userText: string };
const key = (id: string) => ['messages', id];

export function useConversationStream() {
  const qc = useQueryClient();
  const { BACKEND_URL } = (Constants.expoConfig?.extra || {}) as { BACKEND_URL: string };

  return useMutation({
    mutationFn: async ({ conversationId, userText }: StreamArgs) => {
      const res = await fetch(`${BACKEND_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, text: userText }),
      });
      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });

        qc.setQueryData<any[]>(key(conversationId), (prev = []) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') last.content = assistant;
          else copy.push({ id: 'draft', conversation_id: conversationId, role: 'assistant', content: assistant });
          return copy;
        });
      }

      return assistant;
    },
  });
}
