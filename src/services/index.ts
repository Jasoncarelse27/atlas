// Service Layer Exports
export { AtlasAIService, atlasAIService, type AtlasAIServiceInterface } from './atlasAIService';
export { chatService, type ChatServiceInterface } from './chatService';
export { ConversationService, conversationService, type ConversationServiceInterface } from './conversationService';
export { default as LocalMessageStore } from './localMessageStore';

// Service Types
export type {
    AIRequestOptions, AIResponse, ConversationCreateOptions,
    ConversationUpdateOptions,
    MessageCreateOptions
} from './conversationService';

// Re-export for convenience
export { default as atlasAIService } from './atlasAIService';
export { default as chatService } from './chatService';
export { default as conversationService } from './conversationService';

