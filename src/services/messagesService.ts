import { http } from "@/lib/http";

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export const messagesService = {
  list(conversationId: string) {
    return http<Message[]>(`/api/conversations/${conversationId}/messages`, { method: "GET" });
  },
  
  send(conversationId: string, content: string) {
    return http<Message>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  },
};
