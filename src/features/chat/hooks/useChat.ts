import { chatService } from "../../../services/chatService";

export function useChat() {
  const handleSendMessage = async (text: string, onComplete?: () => void) => {
    await chatService.sendMessage(text, onComplete);
  };

  return { handleSendMessage };
}