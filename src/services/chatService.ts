// src/services/chatService.ts

import { LocalMessageStore } from '@/services/localMessageStore'
import { conversationService } from '@/services/conversationService'
import { atlasAIService } from '@/services/atlasAIService'
import { Message } from '@/types/chat'

export interface ChatServiceInterface {
  sendMessage(message: Message, conversationId: string, isSafeMode?: boolean): Promise<Message>
  streamMessage(
    message: Message,
    conversationId: string,
    onChunk: (text: string) => void,
    isSafeMode?: boolean
  ): Promise<Message>
}

class ChatService implements ChatServiceInterface {
  async sendMessage(message: Message, conversationId: string, isSafeMode: boolean = false): Promise<Message> {
    try {
      if (isSafeMode) {
        const savedMessage = await LocalMessageStore.addMessage(conversationId, message)
        return { ...savedMessage, id: savedMessage.id || `local-${Date.now()}` }
      } else {
        const created = await conversationService.createMessage(conversationId, message)
        return created
      }
    } catch (error) {
      console.error('[ChatService][sendMessage] Error:', error)
      throw error
    }
  }

  async streamMessage(
    message: Message,
    conversationId: string,
    onChunk: (text: string) => void,
    isSafeMode: boolean = false
  ): Promise<Message> {
    let finalText = ''
    let streamedMessage: Message = {
      ...message,
      content: '',
      role: 'assistant',
      status: 'streaming',
    }

    try {
      await atlasAIService.streamCompletion(message.content, {
        onChunk: (chunk) => {
          finalText += chunk
          streamedMessage.content = finalText
          onChunk(chunk)
        },
      })

      streamedMessage.content = finalText
      streamedMessage.status = 'completed'

      if (isSafeMode) {
        await LocalMessageStore.addMessage(conversationId, streamedMessage)
      } else {
        streamedMessage = await conversationService.upsertMessage(conversationId, streamedMessage)
      }

      return streamedMessage
    } catch (error) {
      console.error('[ChatService][streamMessage] Error:', error)
      streamedMessage.status = 'error'
      streamedMessage.error = (error as Error).message
      return streamedMessage
    }
  }
}

export const chatService = new ChatService()
