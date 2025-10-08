import { useCallback, useState } from 'react';
import type { MediaMessage } from '../features/chat/hooks/useMessages';
import ImageMessageBubble from './messages/ImageMessageBubble';

interface EnhancedMessageBubbleProps {
  message: MediaMessage;
  isOwnMessage: boolean;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export function EnhancedMessageBubble({ 
  message, 
  isOwnMessage, 
  onRetry, 
  onDelete 
}: EnhancedMessageBubbleProps) {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (onRetry && message.sync_status === 'failed') {
      onRetry(message.id);
    }
  }, [onRetry, message.id, message.sync_status]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(message.id);
    }
  }, [onDelete, message.id]);

  // Handle image click
  const handleImageClick = useCallback(() => {
    setIsImageExpanded(!isImageExpanded);
  }, [isImageExpanded]);

  // Handle audio play/pause
  const handleAudioToggle = useCallback(() => {
    setIsPlayingAudio(!isPlayingAudio);
    // Here you would implement actual audio playback logic
    // For now, just toggle the state
  }, [isPlayingAudio]);

  // Get message status indicator
  const getStatusIndicator = () => {
    if (message.sync_status === 'pending') {
      return (
        <div className="flex items-center space-x-1 text-xs text-gray-400">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <span>Sending...</span>
        </div>
      );
    }
    
    if (message.sync_status === 'failed') {
      return (
        <div className="flex items-center space-x-1 text-xs text-red-400">
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <span>Failed</span>
          {onRetry && (
            <button
              onClick={handleRetry}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          )}
        </div>
      );
    }
    
    if (message.sync_status === 'synced') {
      return (
        <div className="flex items-center space-x-1 text-xs text-gray-400">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span>Sent</span>
        </div>
      );
    }
    
    return null;
  };

  // Render message content based on type
  const renderMessageContent = () => {
    switch (message.type) {
      case 'voice':
        return (
          <div className="space-y-2">
            {/* Voice Player */}
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <button
                onClick={handleAudioToggle}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isPlayingAudio 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isPlayingAudio ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">
                  Voice Message
                </div>
                {message.metadata?.duration && (
                  <div className="text-xs text-gray-500">
                    {Math.round(message.metadata.duration)}s
                  </div>
                )}
              </div>
              
              {/* Audio Waveform (placeholder) */}
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${
                      isPlayingAudio ? 'h-6' : 'h-3'
                    }`}
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      animation: isPlayingAudio ? 'pulse 1s infinite' : 'none'
                    }}
                  ></div>
                ))}
              </div>
            </div>
            
            {/* Transcript */}
            {message.metadata?.transcript && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-4 border-blue-400">
                <div className="font-medium text-gray-700 mb-1">Transcript:</div>
                {message.metadata.transcript}
              </div>
            )}
          </div>
        );

      case 'image':
          id: message.id,
          type: message.type,
          content: message.content,
          metadata: message.metadata,
          imageUrl: message.metadata?.imageUrl,
          status: message.status
        });
        return (
          <ImageMessageBubble 
            message={message}
            onRetry={onRetry ? () => onRetry(message.id) : undefined}
          />
        );

      case 'text':
      default:
        return (
          <div className="text-gray-800 whitespace-pre-wrap break-words">
            {message.content}
          </div>
        );
    }
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {/* Message Bubble */}
        <div
          className={`rounded-lg px-4 py-2 shadow-sm ${
            isOwnMessage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {/* Message Content */}
          {renderMessageContent()}
          
          {/* Timestamp and Status */}
          <div className={`mt-2 flex items-center justify-between text-xs ${
            isOwnMessage ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span>
              {new Date(message.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            
            {/* Status indicator for own messages */}
            {isOwnMessage && getStatusIndicator()}
          </div>
        </div>
        
        {/* Action Buttons */}
        {isOwnMessage && (
          <div className="flex justify-end mt-1 space-x-2">
            {message.sync_status === 'failed' && onRetry && (
              <button
                onClick={handleRetry}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Retry
              </button>
            )}
            
            {onDelete && (
              <button
                onClick={handleDelete}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Avatar placeholder */}
      <div className={`w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium ${
        isOwnMessage ? 'order-1 ml-2' : 'order-2 mr-2'
      }`}>
        {isOwnMessage ? 'You' : 'AI'}
      </div>
    </div>
  );
}
