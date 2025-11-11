import { useTierAccess } from '@/hooks/useTierAccess';
import { audioUsageService } from '@/services/audioUsageService';
import { stopMessageStream } from '@/services/chatService';
import { voiceService } from '@/services/voiceService';
import { motion } from 'framer-motion';
import { Ban, Bot, Check, Copy, Loader2, Pause, Play, ThumbsDown, ThumbsUp, User, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { canUseAudio } from '../../config/featureAccess';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import type { Message } from '../../types/chat';
import { UpgradeButton } from '../UpgradeButton';
import { DeleteMessageModal } from '../modals/DeleteMessageModal';
import { ImageGallery } from './ImageGallery';
import { MessageContextMenu } from './MessageContextMenu';
import { LegacyMessageRenderer } from './MessageRenderer';
import { StopButton } from './StopButton';
import SystemMessage from './SystemMessage';
import { TypingDots } from './TypingDots';

interface EnhancedMessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  isLatestUserMessage?: boolean;
  isTyping?: boolean;
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
  onEdit?: (messageId: string, newContent: string) => void;
}

export default function EnhancedMessageBubble({ message, isLatest = false, isLatestUserMessage = false, isTyping = false, onDelete, onEdit }: EnhancedMessageBubbleProps) {
  

  // ✅ Collect all attachments (check both locations for compatibility)
  const attachments = message.attachments || [];
  
  // Early return if message is invalid or deleted
  if (!message) {
    return null;
  }

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // ✅ CRITICAL FIX: Initialize displayedText immediately for user messages
  const [displayedText, setDisplayedText] = useState(() => {
    // Get initial content
    if (!message.content) return '';
    
    // Handle object format (most common case for user messages from backend)
    if (typeof message.content === 'object' && !Array.isArray(message.content)) {
      const contentObj = message.content as any;
      
      // Debug log for object content
      if (isUser && typeof window !== 'undefined') {
        logger.debug('[DEBUG] User message content is object:', contentObj);
      }
      
      // Try multiple fields to extract text
      const text = contentObj.text || contentObj.content || contentObj.message || '';
      return String(text); // Ensure it's a string
    }
    
    // Handle array format
    if (Array.isArray(message.content)) {
      return message.content.join(' ');
    }
    
    // Handle string format
    if (typeof message.content === 'string') {
      // Check if it's a JSON string that needs parsing
      if (message.content.trim().startsWith('{') && 
          message.content.includes('"type"') && 
          message.content.includes('"text"')) {
        try {
          const parsed = JSON.parse(message.content);
          return parsed.text || parsed.content || message.content;
        } catch (e) {
          return message.content;
        }
      }
      return message.content;
    }
    
    // Fallback - convert to string
    logger.debug('[DEBUG] Unexpected message content format:', message.content);
    return String(message.content || '');
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  
  // TTS state
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  
  // Copy state
  const [isCopied, setIsCopied] = useState(false);
  
  // Feedback state
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  
  // Audio player state for TTS
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioPlayerRef = useRef<HTMLDivElement | null>(null); // ✅ NEW: Ref for click-outside detection
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingForEveryone, setIsDeletingForEveryone] = useState(false);
  
  // ✅ Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { tier, userId } = useTierAccess(); // ✅ FIX: Removed unused 'loading' variable

  // Get content as string for typing effect - needed by handlers
  const messageContent = (() => {
    if (!message.content) return '';
    
    // Handle object format: {type: "text", text: "..."}
    if (typeof message.content === 'object' && !Array.isArray(message.content)) {
      const contentObj = message.content as any;
      // ✅ FIX: Try multiple text fields, never show raw JSON
      const text = contentObj.text || contentObj.content || contentObj.message || '';
      return String(text); // Ensure it's a string
    }
    
    // Handle array format
    if (Array.isArray(message.content)) {
      return message.content.join(' ');
    }
    
    // Handle plain string - BUT CHECK IF IT'S JSON!
    if (typeof message.content === 'string') {
      // ✅ FIX: Parse JSON strings that look like {"type":"text","text":"..."}
      if (message.content.trim().startsWith('{') && 
          message.content.includes('"type"') && 
          message.content.includes('"text"')) {
        try {
          const parsed = JSON.parse(message.content);
          return parsed.text || parsed.content || message.content;
        } catch (e) {
          // Not valid JSON, return as-is
          return message.content;
        }
      }
      return message.content;
    }
    
    return message.content;
  })();
  
  // Debug logging removed - displayedText now initializes correctly

  // Handler functions need to be defined before use
  const handleDeleteForMe = () => {
    if (!onDelete || !message.id) return;
    onDelete(message.id, false);
    setShowDeleteModal(false);
  };

  const handleDeleteForEveryone = () => {
    if (!onDelete || !message.id) return;
    onDelete(message.id, true);
    setIsDeletingForEveryone(true);
    setShowDeleteModal(false);
  };

  const handleEditClick = () => {
    setEditedContent(messageContent);
    setIsEditing(true);
    setShowContextMenu(false);
    setTimeout(() => editTextareaRef.current?.focus(), 0);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setShowContextMenu(false);
  };

  const handleCopy = async () => {
    try {
      const textToCopy = displayedText || messageContent;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // ✅ FIX: Mobile Safari-safe fallback copy method
        // Use a more reliable approach that doesn't rely on Range API
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.setAttribute('readonly', '');
        textArea.setAttribute('aria-hidden', 'true');
        
        // Ensure body exists and is in DOM
        if (!document.body) {
          throw new Error('Document body not available');
        }
        
        document.body.appendChild(textArea);
        
        // ✅ CRITICAL: Check if node still has parent before selection
        // Mobile Safari can remove nodes during selection, causing Range error
        if (textArea.parentNode && document.body.contains(textArea)) {
          // Use setSelectionRange instead of select() to avoid Range API issues
          textArea.focus();
          textArea.setSelectionRange(0, textToCopy.length);
          
          // Verify node is still in DOM before execCommand
          if (textArea.parentNode && document.body.contains(textArea)) {
            const success = document.execCommand('copy');
            if (!success) {
              throw new Error('execCommand copy failed');
            }
          } else {
            throw new Error('Textarea removed from DOM during copy');
          }
        } else {
          throw new Error('Textarea not properly attached to DOM');
        }
        
        // ✅ SAFE REMOVAL: Only remove if still in DOM
        if (textArea.parentNode) {
          document.body.removeChild(textArea);
        }
      }
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      logger.error('[Copy] Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
      // ✅ FALLBACK: Try modern clipboard API as last resort
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(displayedText || messageContent);
          setIsCopied(true);
          toast.success('Copied to clipboard');
          setTimeout(() => setIsCopied(false), 2000);
        }
      } catch (fallbackError) {
        logger.error('[Copy] Fallback also failed:', fallbackError);
      }
    }
    setShowContextMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isUser) return;
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  let touchTimer: NodeJS.Timeout | null = null;
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isUser) return;
    const touch = e.touches[0];
    touchTimer = setTimeout(() => {
      setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowContextMenu(true);
    }, 400);
  };

  const handleTouchMove = (_e: React.TouchEvent) => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  };

  const handleTouchEnd = (_e: React.TouchEvent) => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  };

  const messageAgeMinutes = message.timestamp 
    ? Math.floor((Date.now() - new Date(message.timestamp).getTime()) / 1000 / 60)
    : Infinity;

  // ✅ FIX: Cleanup touchTimer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    };
  }, []);

  // ✅ FIX: Removed noisy warning - userId can be null during initial load, which is normal
  // The tier will still work correctly (defaults to 'free' when userId is null)
  // No need to log this for every message bubble (was causing 102+ warnings)


  // Handle system messages
  if (isSystem) {
    return (
      <SystemMessage 
        text={messageContent} 
        type="info"
        action={<UpgradeButton size="sm" />}
      />
    );
  }

  // For attachment messages, render with custom attachment layout
  if (attachments.length > 0) {
    return (
      <>
        {/* Context Menu */}
        {showContextMenu && (
          <MessageContextMenu
            message={message}
            position={contextMenuPosition}
            onClose={() => setShowContextMenu(false)}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onCopy={handleCopy}
            canEdit={isUser && !message.deletedAt && isLatestUserMessage}
            canDelete={!isUser && !message.deletedAt}
          />
        )}

        {/* Delete Modal */}
        <DeleteMessageModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
          messageAge={messageAgeMinutes}
          isDeletingForEveryone={isDeletingForEveryone}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.15,
            ease: "easeOut"
          }}
          className={`flex items-start mb-3 ${isUser ? 'flex-row-reverse' : ''}`}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Avatar removed per user request */}

          {/* Message Content */}
          <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${
            isUser
              ? 'bg-atlas-sage text-white rounded-br-md'
              : 'bg-white/70 border border-gray-200 text-black rounded-bl-md'
          }`}>
              {/* 🖼️ Enhanced Image Gallery */}
              {attachments.length > 0 && (
                <ImageGallery 
                  attachments={attachments} 
                  isUser={isUser}
                  onContextMenu={isUser ? handleContextMenu : undefined}
                  onTouchStart={isUser ? handleTouchStart : undefined}
                  onTouchMove={isUser ? handleTouchMove : undefined}
                  onTouchEnd={isUser ? handleTouchEnd : undefined}
                />
              )}

              {/* ✅ User Caption - Show caption text under images (only for user messages with attachments) */}
              {isUser && messageContent && messageContent.trim() && (
                <div className="mt-3 text-sm italic text-white">
                  {messageContent.replace(/^"|"$/g, '')}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // Handle non-text message types
  if (message.type && message.type !== 'text') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 0.15,
          ease: "easeOut"
        }}
        className={`flex items-start space-x-3 mb-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-atlas-sage text-white' 
              : 'bg-gradient-to-br from-atlas-gradient-start to-atlas-gradient-end text-gray-800'
          }`}>
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </div>
        </div>

        {/* Message Content - Debug Fallback */}
        <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${
            isUser 
              ? 'bg-atlas-sage text-white rounded-br-md' 
              : 'bg-gradient-to-br from-atlas-gradient-start/10 to-atlas-gradient-end/10 border border-atlas-gradient-start/20 text-gray-100 rounded-bl-md'
          }`}>
            <pre style={{ color: "red", fontSize: 12, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(message, null, 2)}
            </pre>
          </div>
        </div>
      </motion.div>
    );
  }

  // Typing effect for AI text messages - show word by word
  useEffect(() => {
    if (isUser) {
      // ✅ CRITICAL FIX: User messages should always show content immediately
      setDisplayedText(messageContent);
      return;
    }

    // For assistant messages, show typing effect if it's the latest message and not in sending state
    if (isLatest && !isUser && message.status !== 'sending') {
      const timer = setInterval(() => {
        setCurrentIndex(prevIndex => {
          if (prevIndex < messageContent.length) {
            setDisplayedText(messageContent.slice(0, prevIndex + 1));
            return prevIndex + 1;
          }
          return prevIndex;
        });
      }, 25); // Smoother, more natural ChatGPT-like effect

      return () => clearInterval(timer);
    } else {
      // ✅ CRITICAL FIX: For all other cases, show full content immediately
      setDisplayedText(messageContent);
    }
  }, [messageContent, isUser, isLatest, message.status]);

  // Reset typing effect when NEW message arrives (not when ID changes during optimistic→real swap)
  useEffect(() => {
    if (isLatest && !isUser && message.role === 'assistant') {
      // Only reset if content is empty (new message) or different from current
      if (!displayedText || displayedText !== messageContent) {
        // ✅ FIX GLITCH #2: Start with first character to prevent flash
        setDisplayedText(messageContent.charAt(0) || '');
        setCurrentIndex(1);
      }
    }
  }, [messageContent, isLatest, isUser, message.role]); // ✅ Use content, not ID

  const showTypingIndicator = isLatest && !isUser && currentIndex < messageContent.length;
  
  // ✅ IMPROVED TTS handler with audio controls
  const handlePlayTTS = async () => {
    // ✅ IMPROVED: Check actual session, not just loading state
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      logger.warn('[TTS] No active session - waiting for authentication...');
      toast.error('Please sign in to use text-to-speech');
      return;
    }
    
    if (!userId) {
      logger.warn('[TTS] userId not available yet');
      toast.error('Please wait for authentication to complete');
      return;
    }
    
    if (!message.content) {
      logger.warn('[TTS] message content is empty');
      return;
    }
    
    logger.debug('[TTS] Starting TTS playback for tier:', tier);
    
    // ✅ Check tier access using centralized function
    if (!canUseAudio(tier)) {
      toast.error('Text-to-speech requires Core or Studio tier');
      return;
    }
    
    setIsLoadingAudio(true);
    
    try {
      // ✅ FUTURE-PROOF: Check usage limits and stop gracefully if exceeded
      let usageCheck;
      try {
        usageCheck = await audioUsageService.checkAudioUsage(userId, tier);
        if (usageCheck && !usageCheck.canUse) {
          // Show user-friendly message and stop gracefully
          logger.warn('[TTS] Usage limit reached:', usageCheck.warning);
          toast.warning(usageCheck.warning || 'Audio limit reached');
          toast.info('💡 Upgrade to Core tier for unlimited audio!');
          return; // Stop here - don't try to play empty audio
        }
      } catch (usageError) {
        logger.warn('[TTS] Usage check failed, allowing playback:', usageError);
        // Continue anyway - don't block TTS for usage check failures
      }
      
      const text = typeof message.content === 'string' 
        ? message.content 
        : (message.content as any).text || message.content;
      
      logger.debug('[TTS] Synthesizing speech for text length:', text.length);
      
      // Synthesize speech
      const audioDataUrl = await voiceService.synthesizeSpeech(text);
      logger.debug('[TTS] Audio synthesized successfully');
      
      // Store URL for playback control (audio element will auto-play)
      setAudioUrl(audioDataUrl);
      setIsPlayingTTS(true);
      
    } catch (error) {
      // ✅ Silent fail for service unavailable - don't spam console or show toast
      if (error instanceof Error && error.message === 'TTS_SERVICE_UNAVAILABLE') {
        logger.debug('[TTS] Service unavailable - silently failing');
        return; // Exit silently, don't show error
      }
      
      // Only log/show errors for other cases
      if (error instanceof Error) {
        if (error.message.includes('requires Core or Studio')) {
          toast.error('Audio features require Core or Studio tier');
        } else if (error.message.includes('503') || error.message.includes('TTS_SERVICE_UNAVAILABLE')) {
          // Silent - service unavailable is expected if OpenAI not configured
          logger.debug('[TTS] Service unavailable - skipping');
          return;
        } else {
          logger.error('[TTS] Error:', error);
          toast.error('Audio generation failed: ' + error.message);
        }
      } else {
        logger.error('[TTS] Unknown error:', error);
        toast.error('Audio playback failed');
      }
    } finally {
      setIsLoadingAudio(false);
    }
  };


  // Audio control handlers
  const toggleAudioPlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlayingTTS) {
      audioRef.current.pause();
      setIsPlayingTTS(false);
    } else {
      audioRef.current.play();
      setIsPlayingTTS(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingTTS(false);
    setAudioUrl(null);
    setAudioProgress(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setAudioProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const duration = audioRef.current.duration;
      // ✅ FIX: Handle NaN/Infinity duration values
      if (isFinite(duration) && duration > 0) {
        setAudioDuration(duration);
      } else {
        setAudioDuration(0);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingTTS(false);
    setAudioProgress(0);
  };

  // ✅ BEST PRACTICE: Click outside to close audio player (WhatsApp/Telegram-style)
  useEffect(() => {
    if (!audioUrl) return; // Only listen when player is open

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Don't close if clicking on the audio player itself
      if (audioPlayerRef.current && audioPlayerRef.current.contains(event.target as Node)) {
        return;
      }
      
      // Close the audio player when clicking outside
      stopAudio();
    };

    // Small delay to prevent immediate close from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [audioUrl]);

  // ✅ PROFESSIONAL: Time formatting with proper handling (WhatsApp/Telegram-style)
  const formatTime = (seconds: number): string => {
    // Handle invalid/NaN values
    if (!isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ✅ PHASE 2: Context Menu Handlers

  // ✅ Mobile: Long-press handler for touch devices
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleEditSave = () => {
    if (!editedContent.trim() || editedContent === messageContent) {
      setIsEditing(false);
      return;
    }
    
    if (onEdit) {
      onEdit(message.id, editedContent.trim());
      toast.success('Message edited');
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // ✅ Show deleted message placeholder
  if (message.deletedAt) {
    return (
      <motion.div
        id={`message-${message.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-start mb-3 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        <div className={`flex-1 ${isUser ? 'max-w-[75%] flex justify-end' : 'w-full max-w-[75%]'}`}>
          <div className={`px-4 py-3 rounded-2xl flex items-center gap-2 text-sm ${
            isUser ? 'bg-gray-800/30 text-gray-400' : 'bg-gray-100 text-gray-500'
          }`}>
            <Ban className="w-4 h-4 flex-shrink-0" />
            <span className="italic">
              {message.deletedBy === 'everyone' ? 'This message was deleted' : 'You deleted this message'}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Context Menu */}
      {showContextMenu && (
        <MessageContextMenu
          message={message}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onCopy={handleCopy}
          canEdit={isUser && !message.deletedAt && isLatestUserMessage}
          canDelete={!isUser && !message.deletedAt}
        />
      )}

      {/* Delete Modal */}
      <DeleteMessageModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        messageAge={messageAgeMinutes}
        isDeletingForEveryone={isDeletingForEveryone}
      />

      <div
        id={`message-${message.id}`}
        className={`flex items-start ${isUser ? 'flex-row-reverse' : ''}`}
        style={{ marginBottom: '12px' }}
        onContextMenu={handleContextMenu} // ✅ Right-click handler (desktop)
        onTouchStart={handleTouchStart}   // ✅ Long-press start (mobile)
        onTouchMove={handleTouchMove}     // ✅ Long-press move detection (mobile)
        onTouchEnd={handleTouchEnd}       // ✅ Long-press end (mobile)
      >
      {/* Avatar removed per design requirements */}
      {/* <div className={`flex-shrink-0 ${isUser ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-atlas-sage text-white' 
            : 'bg-gradient-to-br from-atlas-primary to-atlas-accent text-gray-800'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
      </div> */}

      {/* Message Content */}
      <div className={`flex-1 ${isUser ? 'max-w-[75%] sm:max-w-[70%] md:max-w-[60%] flex justify-end' : 'w-full'}`}>
        <div 
          className={`relative ${
            isUser 
              ? 'px-4 py-2 rounded-2xl bg-atlas-sage text-white shadow-md text-[15px] leading-relaxed' 
              : 'px-5 py-3 max-w-none text-[16px] leading-relaxed'
          }`} 
          style={{ 
            wordBreak: "break-word", 
            overflowWrap: "anywhere",
            overflowX: "hidden", // ✅ FIX: Prevent horizontal scroll
            color: isUser ? undefined : '#000000' // Pure black for maximum visibility
          }}
        >
          {(!isUser && ((message.status === 'sending' && (!displayedText || displayedText === '...')) || isTyping)) ? (
              <div className="flex items-center space-x-3">
                <TypingDots />
              </div>
            ) : isEditing ? (
              // ✅ Edit Mode UI
              <div className="space-y-2">
                <textarea
                  ref={editTextareaRef}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full min-h-[80px] px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                  placeholder="Edit your message..."
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={handleEditCancel}
                    className="px-3 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={!editedContent.trim() || editedContent === messageContent}
                    className="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-white/50 italic">Press Enter to save, Esc to cancel</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {displayedText ? (
                    isUser ? (
                      // Simple rendering for user messages - no markdown  
                      <span className="block">{displayedText}</span>
                    ) : (
                      // Keep markdown for assistant messages with enhanced spacing matching MessageRenderer
                      <div className="[&>*]:m-0 [&_p]:m-0 [&_.prose]:m-0 [&_.prose>*]:m-0 
                        [&_.prose_p]:mb-4 [&_.prose_p:last-child]:mb-0 [&_.prose_p]:leading-relaxed
                        [&_.prose_h1]:mb-3 [&_.prose_h2]:mb-2 [&_.prose_h3]:mb-2
                        [&_.prose_ul]:mb-5 [&_.prose_ul]:space-y-2.5
                        [&_.prose_ol]:mb-5 [&_.prose_ol]:space-y-2.5
                        [&_.prose_li]:leading-relaxed
                        [&_.prose_blockquote]:my-3
                        [&_.prose_table]:my-6
                        [&_.prose_table]:overflow-x-auto
                        [&_.prose_table]:-mx-2
                        [&_.prose_table]:sm:mx-0">
                        <LegacyMessageRenderer content={displayedText} />
                      </div>
                    )
                  ) : (
                    <span className="text-gray-400 italic">Empty message</span>
                  )}
                </div>
                {message.status === 'sending' && displayedText && !isUser && (
                  <StopButton 
                    onPress={() => {
                      stopMessageStream();
                      toast.info('Response cancelled - Partial response kept');
                    }}
                    isVisible={true}
                  />
                )}
              </div>
            )}

          {/* 🖼️ Enhanced Image Gallery - SINGLE SOURCE OF TRUTH for image rendering */}
          {attachments.length > 0 && (
            <ImageGallery 
              attachments={attachments} 
              isUser={isUser}
              onContextMenu={isUser ? handleContextMenu : undefined}
              onTouchStart={isUser ? handleTouchStart : undefined}
              onTouchMove={isUser ? handleTouchMove : undefined}
              onTouchEnd={isUser ? handleTouchEnd : undefined}
            />
          )}

          {/* ✅ User Caption - Show caption text under images (only for user messages with attachments) */}
          {isUser && messageContent && messageContent.trim() && attachments.length > 0 && (
            <div className="mt-3 text-sm italic text-gray-300">
              {messageContent.replace(/^"|"$/g, '')}
            </div>
          )}

          {/* ✅ Edited indicator */}
          {message.editedAt && !isEditing && (
            <div className="mt-1 text-xs opacity-50 italic">
              (edited)
            </div>
          )}

          {/* ✅ Show uploading status */}
          {message.status === "uploading" && (
            <div className="mt-2 text-xs opacity-70 flex items-center">
              <span className="animate-spin mr-2">⏳</span>
              Uploading...
            </div>
          )}

          {/* Message Status Indicators removed - cleaner UI */}
          
          {/* Action Buttons for AI messages - Orange Icon-Only Style */}
          {!isUser && !showTypingIndicator && message.status !== 'sending' && (
            <div className="flex items-center gap-2 mt-2">
              {/* Copy Button - ✅ MOBILE FIX: Proper touch targets and event handling */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopy();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-[#FF9933] hover:text-[#FF7700] active:text-[#FF6600] transition-colors duration-200 touch-manipulation"
                style={{ touchAction: 'manipulation' }}
                aria-label="Copy message"
                title={isCopied ? 'Copied!' : 'Copy message'}
              >
                {isCopied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {/* Share Button - ✅ MOBILE FIX: Native share API support */}
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    const textToShare = displayedText || messageContent;
                    if (navigator.share) {
                      await navigator.share({
                        title: 'Atlas AI Response',
                        text: textToShare,
                        url: window.location.href
                      });
                      toast.success('Shared!');
                    } else {
                      // Fallback to copy
                      await handleCopy();
                    }
                  } catch (error: any) {
                    // User cancelled or error - don't show error for cancellation
                    if (error.name !== 'AbortError') {
                      logger.debug('[Share] Share failed:', error);
                      // Fallback to copy
                      await handleCopy();
                    }
                  }
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-[#FF9933] hover:text-[#FF7700] active:text-[#FF6600] transition-colors duration-200 touch-manipulation"
                style={{ touchAction: 'manipulation' }}
                aria-label="Share message"
                title="Share message"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              {/* Thumbs Up - ✅ MOBILE FIX: Proper touch targets */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFeedback(feedback === 'positive' ? null : 'positive');
                  toast.success('Thanks for your feedback!');
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 transition-colors duration-200 touch-manipulation ${
                  feedback === 'positive' 
                    ? 'text-[#FF9933]' 
                    : 'text-[#FF9933] hover:text-[#FF7700] active:text-[#FF6600]'
                }`}
                style={{ touchAction: 'manipulation' }}
                aria-label="Good response"
                title="Good response"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>

              {/* Thumbs Down - ✅ MOBILE FIX: Proper touch targets */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFeedback(feedback === 'negative' ? null : 'negative');
                  toast.error('Feedback noted. We\'ll improve!');
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 transition-colors duration-200 touch-manipulation ${
                  feedback === 'negative' 
                    ? 'text-[#FF9933]' 
                    : 'text-[#FF9933] hover:text-[#FF7700] active:text-[#FF6600]'
                }`}
                style={{ touchAction: 'manipulation' }}
                aria-label="Bad response"
                title="Bad response"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>

              {/* Audio Controls - ✅ MOBILE FIX: Proper touch targets */}
              {!audioUrl ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePlayTTS();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  disabled={isLoadingAudio}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-[#FF9933] hover:text-[#FF7700] active:text-[#FF6600] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  style={{ touchAction: 'manipulation' }}
                  aria-label="Listen to message"
                  title="Listen to message"
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div 
                  ref={audioPlayerRef}
                  onClick={(e) => e.stopPropagation()} // ✅ Prevent closing when clicking player
                  className="flex items-center gap-1 p-1 sm:gap-1.5 sm:p-1.5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-md sm:rounded-lg border border-gray-200/50 shadow-sm w-full max-w-full overflow-hidden"
                >
                  {/* Play/Pause Button - ✅ ULTRA-COMPACT: 32px mobile, 40px desktop */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAudioPlayback();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 touch-manipulation flex-shrink-0 ${
                      isPlayingTTS
                        ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-md'
                        : 'bg-atlas-sage hover:bg-atlas-sage/90 active:bg-atlas-sage/80 text-white shadow-sm'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                    aria-label={isPlayingTTS ? 'Pause audio' : 'Play audio'}
                    title={isPlayingTTS ? 'Pause' : 'Play'}
                  >
                    {isLoadingAudio ? (
                      <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isPlayingTTS ? (
                      <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />
                    )}
                  </button>

                  {/* ✅ ULTRA-COMPACT: Minimal timer - no padding, tight spacing */}
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/60 rounded sm:rounded-md justify-center flex-shrink-0">
                    <span className="text-[10px] sm:text-xs font-mono font-medium text-gray-700 tabular-nums whitespace-nowrap">
                      {formatTime(audioProgress)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-normal">/</span>
                    <span className="text-[10px] sm:text-xs font-mono font-medium text-gray-700 tabular-nums whitespace-nowrap">
                      {formatTime(audioDuration || 0)}
                    </span>
                  </div>

                  {/* Stop/Close Button - ✅ ULTRA-COMPACT: 32px mobile, 40px desktop */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      stopAudio();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0
                               bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-600 hover:text-gray-800
                               transition-all duration-200 touch-manipulation shadow-sm"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Stop and close audio player"
                    title="Stop"
                  >
                    <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Hidden audio element for TTS playback */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              autoPlay
            />
          )}
        </div>
      </div>
    </div>
    </>
  );
}
