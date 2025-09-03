import React from 'react';
import { useSafeMode } from '../../../context/SafeModeContext';
import type { Message } from '../../../types/chat';

interface MessageRendererProps {
  message: Message;
  isLastMessage?: boolean;
  onRetry?: () => void;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ message, isLastMessage = false, onRetry }) => {
  const { isSafeMode } = useSafeMode();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isLoading = message.status === 'sending';
  const hasError = message.error || message.status === 'failed';

  const renderContent = () => {
    if (message.content.type === 'text') {
      return message.content.text || '';
    }
    
    if (message.content.type === 'image') {
      return (
        <div>
          <span>📷 Image uploaded</span>
          {message.content.text && (
            <div style={{ marginTop: 8 }}>{message.content.text}</div>
          )}
        </div>
      );
    }
    
    return null;
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
