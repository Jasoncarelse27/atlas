import { useState } from 'react';
import type { Message } from '../../types/chat';

interface ImageMessageBubbleProps {
  message: Message;
  onRetry?: () => void;
}

export function ImageMessageBubble({ message, onRetry }: ImageMessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 🎯 FUTURE-PROOF FIX: Get image URL from multiple possible sources
  const getImageUrl = () => {
    // Try different possible image URL sources
    return message.url || 
           message.content || 
           message.imageUrl ||
           message.metadata?.url ||
           (message.attachments && message.attachments[0]?.url);
  };

  const imageUrl = getImageUrl();
  
  console.log('[ImageMessageBubble] Image URL resolved:', {
    messageId: message.id,
    imageUrl,
    messageUrl: message.url,
    messageContent: message.content,
    metadata: message.metadata,
    attachments: message.attachments
  });

  const handleImagePress = () => {
    if (message.status === 'done' && !imageError && imageUrl) {
      setIsExpanded(true);
    }
  };

  const handleImageError = () => {
    console.error('[ImageMessageBubble] Image failed to load:', imageUrl);
    setImageError(true);
  };

  const renderUploadingState = () => (
    <div className="relative bg-gray-100 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
      {/* Local preview */}
      {imageUrl && (
        <img
          src={imageUrl}
          className="w-full h-48 rounded-lg object-cover"
          onError={handleImageError}
          alt="Uploading image"
        />
      )}
      
      {/* Upload overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        <div className="text-white text-sm mt-2">
          {message.progress ? `${message.progress}%` : 'Uploading...'}
        </div>
      </div>
    </div>
  );

  const renderDoneState = () => (
    <div onClick={handleImagePress} className="relative cursor-pointer">
      {imageUrl ? (
        <img
          src={imageUrl}
          className="rounded-lg max-w-[70%]"
          style={{ aspectRatio: '16/9' }}
          onError={handleImageError}
          alt="Shared image"
        />
      ) : (
        <div className="bg-gray-100 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
          <div className="text-gray-500 text-sm">Image not available</div>
        </div>
      )}
      
      {/* Tap to expand indicator */}
      {imageUrl && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 px-2 py-1 rounded">
          <span className="text-white text-xs">Click to expand</span>
        </div>
      )}
    </div>
  );

  const renderErrorState = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      {imageUrl && (
        <img
          src={imageUrl}
          className="w-full h-32 rounded mb-3 object-cover"
          onError={handleImageError}
          alt="Failed upload"
        />
      )}
      
      <div className="flex items-center justify-between">
        <span className="text-red-600 text-sm flex-1">
          Upload failed. {message.error || 'Please try again.'}
        </span>
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-500 px-3 py-1 rounded text-white text-sm"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    // 🎯 FUTURE-PROOF FIX: Add debugging for image URL resolution
    if (!imageUrl) {
      console.warn('[ImageMessageBubble] No image URL found for message:', {
        messageId: message.id,
        messageUrl: message.url,
        messageContent: message.content,
        metadata: message.metadata,
        attachments: message.attachments,
        status: message.status
      });
    }

    if (message.status === 'uploading') {
      return renderUploadingState();
    }
    
    if (message.status === 'error') {
      return renderErrorState();
    }
    
    if (message.status === 'done') {
      return renderDoneState();
    }
    
    // Fallback for unknown states
    return renderDoneState();
  };

  return (
    <>
      {renderContent()}
      
      {/* Fullscreen Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setIsExpanded(false)}
        >
          <button
            className="absolute top-12 right-4 z-10 text-white text-lg"
            onClick={() => setIsExpanded(false)}
          >
            ✕
          </button>
          
          {imageUrl && (
            <img
              src={imageUrl}
              className="max-w-full max-h-full object-contain"
              onError={handleImageError}
              alt="Expanded image"
            />
          )}
        </div>
      )}
    </>
  );
}

export default ImageMessageBubble;
