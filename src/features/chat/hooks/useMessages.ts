import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userMessage } from "../../../lib/error";
import { messagesService } from "../../../services/messagesService";

import { logger } from '../utils/logger';
export function useMessages(conversationId: string) {
  const qc = useQueryClient();
  const qk = ["messages", conversationId];
  
  const list = useQuery({
    queryKey: qk,
    queryFn: () => messagesService.list(conversationId),
    select: (msgs) => msgs.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  
  const send = useMutation({
    mutationFn: (content: string) => messagesService.send(conversationId, content),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = (qc.getQueryData<any[]>(qk) || []);
      const optimistic = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: "user",
        content,
        createdAt: new Date().toISOString()
      };
      qc.setQueryData(qk, [...prev, optimistic]);
      return { prev };
    },
    onError: (_err: unknown, _v, ctx) => {
      qc.setQueryData(qk, ctx?.prev);
      logger.error(userMessage(err));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk })
  });
  
  return { list, send };
}