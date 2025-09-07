import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { streamAssistant } from "@/features/chat/services/conversationService";

export interface UiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  isStreaming?: boolean;
  ts: number;
}

export function useMessageStream(conversationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (text: string) => {
      // Stream from service
      const parts: string[] = [];
      for await (const chunk of streamAssistant({ conversationId, text })) {
        parts.push(chunk);
        // Append chunk to assistant message in cache
        qc.setQueryData<UiMessage[]>(qk.convo(conversationId), (prev = []) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (!last || last.role !== "assistant" || !last.isStreaming) {
            // initialize streaming assistant
            copy.push({
              id: "asst-" + Date.now(),
              role: "assistant",
              text: chunk,
              isStreaming: true,
              ts: Date.now(),
            });
            return copy;
          }
          last.text += chunk;
          return copy;
        });
      }
    },
    onMutate: async (text: string) => {
      await qc.cancelQueries({ queryKey: qk.convo(conversationId) });
      const previous = qc.getQueryData<UiMessage[]>(qk.convo(conversationId));

      // Optimistically add user message
      qc.setQueryData<UiMessage[]>(qk.convo(conversationId), (prev = []) => [
        ...prev,
        { id: "user-" + Date.now(), role: "user", text, ts: Date.now() },
      ]);

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.convo(conversationId), ctx.previous);
    },
    onSettled: () => {
      // Mark assistant as done streaming
      qc.setQueryData<UiMessage[]>(qk.convo(conversationId), (prev = []) =>
        prev.map((m, i, all) =>
          i === all.length - 1 && m.role === "assistant"
            ? { ...m, isStreaming: false }
            : m
        )
      );
      // (Optional) invalidate to sync with server history later
      // qc.invalidateQueries({ queryKey: qk.convo(conversationId) });
    },
  });
}
