import React from 'react';
import { useSafeMode } from '../../../context/SafeModeContext';
import type { Message } from '../../../types/chat';

interface MessageRendererProps {
  message: Message;
  isLastMessage?: boolean;
  onRetry?: () => void;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onRetry }) => {
  const { isSafeMode } = useSafeMode();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isLoading = message.status === 'sending';
  const hasError = message.error || message.status === 'failed';

  const renderContent = () => {
    // Handle different message types
    if (message.type === 'image' && message.url) {
      return (
        <div className="space-y-2">
          <img
            src={message.url}
            alt="Uploaded image"
            className="max-w-xs rounded-lg border border-gray-600 shadow-lg"
            style={{ maxHeight: '300px', objectFit: 'cover' }}
          />
          {/* ✅ User Caption - Shows user's caption under the image */}
          {message.content && message.content.trim() && (
            <div className="text-sm text-gray-300 mt-2 italic">
              "{message.content}"
            </div>
          )}
          {message.metadata?.dimensions && (
            <div className="text-xs text-gray-400">
              {message.metadata.dimensions.width} × {message.metadata.dimensions.height}
            </div>
          )}
        </div>
      );
    }

    if (message.type === 'audio' && message.url) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-300">{message.content}</div>
          <audio 
            controls 
            src={message.url} 
            className="w-full max-w-sm"
            style={{ backgroundColor: '#333', borderRadius: '8px' }}
          >
            Your browser does not support the audio element.
          </audio>
          {message.metadata?.duration && (
            <div className="text-xs text-gray-400">
              Duration: {Math.round(message.metadata.duration)}s
            </div>
          )}
        </div>
      );
    }

    if (message.type === 'file' && message.url) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-300">{message.content}</div>
          <a
            href={message.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-atlas-sage hover:text-blue-300 underline"
          >
            <span>📎</span>
            <span>{message.metadata?.filename || 'Download file'}</span>
          </a>
          {message.metadata?.size && (
            <div className="text-xs text-gray-400">
              Size: {(message.metadata.size / 1024 / 1024).toFixed(2)} MB
            </div>
          )}
        </div>
      );
    }

    // Default text content
    return message.content || '';
  };

  return (
    <div style={{ padding: 8 }}>
      {/* SafeSpace Mode Indicator */}
      {isSafeMode && (
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderColor: '#B2BDA3', 
          border: '1px solid',
          borderRadius: 4,
          padding: 4,
          marginBottom: 8,
          fontSize: '12px',
          color: '#B2BDA3',
          textAlign: 'center'
        }}>
          🔒 SafeSpace Mode - Message stored locally only
        </div>
      )}
      
      {isUser && (
        <div style={{ color: '#fff', backgroundColor: '#444', borderRadius: 8, padding: 10 }}>
          {renderContent()}
        </div>
      )}

      {isAssistant && (
        <div style={{ backgroundColor: '#222', borderRadius: 8, padding: 10 }}>
          {isLoading ? (
            <div style={{ color: '#999' }}>Loading...</div>
          ) : hasError ? (
            <div style={{ color: 'red', cursor: 'pointer' }} onClick={onRetry}>
              ⚠️ Error. Click to retry.
            </div>
          ) : (
            <div style={{ color: '#fff' }}>{renderContent()}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageRenderer;
