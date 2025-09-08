import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagesService } from "@/services/messagesService";
import { userMessage } from "@/lib/error";

export function useMessages(conversationId: string) {
  const qc = useQueryClient();
  const qk = ["messages", conversationId];
  
  const list = useQuery({
    queryKey: qk,
    queryFn: () => messagesService.list(conversationId)
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
    onError: (err: any, _v, ctx) => {
      qc.setQueryData(qk, ctx?.prev);
      console.error(userMessage(err));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk })
  });
  
  return { list, send };
}