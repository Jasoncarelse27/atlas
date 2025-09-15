import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageUploader } from '../../components/ImageUploader';
import { VoiceRecorder } from '../../components/VoiceRecorder';
import { useMessageLimit } from '../../hooks/useMessageLimit';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useUserTier } from '../../hooks/useUserTier';
import { useTierAccess } from '../hooks/useSubscription';

interface InputToolbarProps {
  onSendMessage: (content: string, type: 'text' | 'voice' | 'image', metadata?: any) => void;
  onError: (error: string) => void;
  onUpgrade?: () => void;
  isDisabled?: boolean;
  placeholder?: string;
  userId: string;
  conversationId: string;
}

interface InputState {
  text: string;
  isExpanded: boolean;
  showVoiceRecorder: boolean;
  showImageUploader: boolean;
}

export function InputToolbar({ 
  onSendMessage, 
  onError, 
  onUpgrade,
  isDisabled = false,
  placeholder = "Type a message...",
  userId,
  conversationId
}: InputToolbarProps) {
  const { isOnline } = useNetworkStatus();
  const { tier } = useUserTier(userId);
  const { canUse } = useTierAccess(tier);
  const { blocked, remaining, increment, isUnlimited } = useMessageLimit(conversationId, userId);
  
  const [inputState, setInputState] = useState<InputState>({
    text: '',
    isExpanded: false,
    showVoiceRecorder: false,
    showImageUploader: false,
  });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Check if user can send messages
  const canSendText = inputState.text.trim().length > 0 && !blocked && !isDisabled;
  const canUseVoice = canUse('audio') && isOnline && !blocked;
  const canUseImage = canUse('image') && isOnline && !blocked;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputState.text]);

  // Handle text input change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputState(prev => ({ ...prev, text: e.target.value }));
  }, []);

  // Handle textarea focus
  const handleFocus = useCallback(() => {
    setInputState(prev => ({ ...prev, isExpanded: true }));
  }, []);

  // Handle textarea blur
  const handleBlur = useCallback(() => {
    if (!inputState.text.trim()) {
      setInputState(prev => ({ ...prev, isExpanded: false }));
    }
  }, [inputState.text]);

  // Handle send message with limit checking
  const handleSend = useCallback(() => {
    const trimmedText = inputState.text.trim();
    if (!trimmedText) return;

    // Check if user is blocked
    if (blocked) {
      if (onUpgrade) {
        onUpgrade();
      } else {
        onError('⚠️ Free tier limited to 15 messages. Upgrade to continue!');
      }
      return;
    }

    onSendMessage(trimmedText, 'text');
    increment(); // Increment message count
    setInputState(prev => ({ ...prev, text: '', isExpanded: false }));
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputState.text, onSendMessage, blocked, onUpgrade, onError, increment]);

  // Handle voice transcript
  const handleVoiceTranscript = useCallback((transcript: string) => {
    if (blocked) {
      if (onUpgrade) {
        onUpgrade();
      } else {
        onError('⚠️ Free tier limited to 15 messages. Upgrade to continue!');
      }
      return;
    }

    onSendMessage(transcript, 'voice');
    increment(); // Increment message count
    setInputState(prev => ({ ...prev, showVoiceRecorder: false }));
  }, [onSendMessage, blocked, onUpgrade, onError, increment]);

  // Handle image selection
  const handleImageSelected = useCallback((imageUrl: string, metadata: any) => {
    if (blocked) {
      if (onUpgrade) {
        onUpgrade();
      } else {
        onError('⚠️ Free tier limited to 15 messages. Upgrade to continue!');
      }
      return;
    }

    onSendMessage(imageUrl, 'image', metadata);
    increment(); // Increment message count
    setInputState(prev => ({ ...prev, showImageUploader: false }));
  }, [onSendMessage, blocked, onUpgrade, onError, increment]);

  // Handle voice recorder error
  const handleVoiceError = useCallback((error: string) => {
    onError(error);
    setInputState(prev => ({ ...prev, showVoiceRecorder: false }));
  }, [onError]);

  // Handle image uploader error
  const handleImageError = useCallback((error: string) => {
    onError(error);
    setInputState(prev => ({ ...prev, showImageUploader: false }));
  }, [onError]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Show upgrade modal for locked features
  const showUpgradeModal = useCallback((feature: string) => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      onError(`⚠️ ${feature} features are available in Atlas Core or Studio. Upgrade to continue!`);
    }
  }, [onUpgrade, onError]);

  // Handle voice button click
  const handleVoiceClick = useCallback(() => {
    if (!canUse('audio')) {
      showUpgradeModal('Voice');
      return;
    }
    if (!isOnline) {
      onError('Voice features require an internet connection');
      return;
    }
    setInputState(prev => ({ ...prev, showVoiceRecorder: true }));
  }, [canUse, showUpgradeModal, isOnline, onError]);

  // Handle image button click
  const handleImageClick = useCallback(() => {
    if (!canUse('image')) {
      showUpgradeModal('Image analysis');
      return;
    }
    if (!isOnline) {
      onError('Image features require an internet connection');
      return;
    }
    setInputState(prev => ({ ...prev, showImageUploader: true }));
  }, [canUse, showUpgradeModal, isOnline, onError]);

  return (
    <>
      {/* Main Input Toolbar */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-end space-x-3">
          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputState.text}
              onChange={handleTextChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyPress={handleKeyPress}
              placeholder={
                blocked 
                  ? "Upgrade to send more messages" 
                  : placeholder
              }
              disabled={isDisabled || blocked}
              rows={inputState.isExpanded ? 3 : 1}
              className={`w-full resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                inputState.isExpanded ? 'min-h-[80px]' : 'min-h-[40px]'
              } ${isDisabled || blocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            
            {/* Character count and usage indicator */}
            {inputState.isExpanded && (
              <div className="absolute bottom-1 right-2 text-xs text-gray-400 flex gap-2">
                <span>{inputState.text.length}/1000</span>
                {!isUnlimited && (
                  <span className="text-blue-600 font-medium">
                    {remaining} left
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Voice Button */}
          <button
            onClick={handleVoiceClick}
            disabled={!canUseVoice}
            className={`p-2 rounded-lg transition-colors ${
              canUseVoice
                ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title={
              !canUse('audio') 
                ? 'Voice features available in Atlas Core' 
                : !isOnline 
                  ? 'Voice unavailable offline' 
                  : 'Record voice message'
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Image Button */}
          <button
            onClick={handleImageClick}
            disabled={!canUseImage}
            className={`p-2 rounded-lg transition-colors ${
              canUseImage
                ? 'text-green-600 hover:bg-green-50 hover:text-green-700'
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title={
              !canUse('image') 
                ? 'Image analysis available in Atlas Core' 
                : !isOnline 
                  ? 'Image upload unavailable offline' 
                  : 'Add image'
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSendText}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              canSendText
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </div>

        {/* Status Messages */}
        {blocked && (
          <div className="mt-2 text-center text-sm text-red-600 bg-red-50 p-2 rounded-lg">
            ⚠️ Free tier limited to 15 messages. <button className="text-blue-600 hover:underline font-medium" onClick={onUpgrade}>Upgrade to continue</button>
          </div>
        )}

        {!isOnline && (
          <div className="mt-2 text-center text-sm text-gray-500 bg-yellow-50 p-2 rounded-lg">
            📱 You're offline. Messages will be sent when connection is restored.
          </div>
        )}

        {isOnline && !canUse('audio') && !blocked && (
          <div className="mt-2 text-center text-sm text-gray-500 bg-blue-50 p-2 rounded-lg">
            🎙️ Voice recording requires Core or Studio tier. <button className="text-blue-600 hover:underline" onClick={onUpgrade}>Upgrade</button>
          </div>
        )}

        {isOnline && !canUse('image') && !blocked && (
          <div className="mt-2 text-center text-sm text-gray-500 bg-green-50 p-2 rounded-lg">
            🖼️ Image analysis requires Core or Studio tier. <button className="text-blue-600 hover:underline" onClick={onUpgrade}>Upgrade</button>
          </div>
        )}
      </div>

      {/* Voice Recorder Modal */}
      <VoiceRecorder
        isVisible={inputState.showVoiceRecorder}
        onTranscriptReady={handleVoiceTranscript}
        onError={handleVoiceError}
        onCancel={() => setInputState(prev => ({ ...prev, showVoiceRecorder: false }))}
      />

      {/* Image Uploader Modal */}
      <ImageUploader
        isVisible={inputState.showImageUploader}
        onImageSelected={handleImageSelected}
        onError={handleImageError}
        onCancel={() => setInputState(prev => ({ ...prev, showImageUploader: false }))}
      />
    </>
  );
}
