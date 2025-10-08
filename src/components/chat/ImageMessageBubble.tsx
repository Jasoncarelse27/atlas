import { RefreshCw, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from "react";
import type { Message } from '../../types/chat';

interface ImageMessageBubbleProps {
  message: Message;
  onRetry?: (messageId: string) => void;
  allMessages?: Message[];
}

export function ImageMessageBubble({ message, onRetry, allMessages = [] }: ImageMessageBubbleProps) {
  const [imageError, setImageError] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  
  // Gallery navigation state
  const images = allMessages.filter((m) => m.type === "image" && (m.metadata?.imageUrl || m.content));
  const currentIndex = images.findIndex((m) => m.id === message.id);
  const [index, setIndex] = useState(currentIndex);
  
  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  const pinchRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  // Always prefer metadata.imageUrl, fallback to content
  const imageUrl = message?.metadata?.imageUrl || message?.content;
  const isUploading = message.metadata?.uploading === true;
  const hasError = message.error === true;
  const uploadError = message.metadata?.uploadError === true;
  const localPreview = message.metadata?.localPreview; // blob URL
  const uploadProgress = message.metadata?.uploadProgress ?? 0;
  const caption = message.metadata?.caption; // Get caption from metadata
  

  const openViewer = () => {
    setIndex(currentIndex);
    setShowFullscreen(true);
  };

  const closeViewer = () => {
    setShowFullscreen(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const prevImage = () => setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const nextImage = () => setIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  // ⌨️ Keyboard navigation
  useEffect(() => {
    if (!showFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showFullscreen]);

  // 🤏 Pinch-to-zoom
  useEffect(() => {
    if (!showFullscreen || !pinchRef.current) return;
    const el = pinchRef.current;

    let initialDist = 0;
    let initialScale = 1;

    const distance = (t1: Touch, t2: Touch) =>
      Math.sqrt((t1.pageX - t2.pageX) ** 2 + (t1.pageY - t2.pageY) ** 2);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDist = distance(e.touches[0], e.touches[1]);
        initialScale = scale;
        const midX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        const midY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
        setOrigin({ x: midX, y: midY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const newDist = distance(e.touches[0], e.touches[1]);
        const newScale = Math.min(4, Math.max(1, initialScale * (newDist / initialDist)));
        setScale(newScale);
      }
    };

    el.addEventListener("touchstart", handleTouchStart);
    el.addEventListener("touchmove", handleTouchMove);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [showFullscreen, scale]);

  // 👆 Double-tap / double-click zoom
  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    const timeSince = now - lastTapRef.current;
    if (timeSince < 300 && timeSince > 0) {
      if (scale > 1) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      } else {
        const rect = (e.target as HTMLImageElement).getBoundingClientRect();
        setOrigin({ x: rect.width / 2, y: rect.height / 2 });
        setScale(2);
      }
    }
    lastTapRef.current = now;
  };

  // 🖱️/👆 Drag-to-pan
  const startDrag = (x: number, y: number) => {
    if (scale <= 1) return;
    setDragging(true);
    lastPosRef.current = { x, y };
  };
  const moveDrag = (x: number, y: number) => {
    if (!dragging || !lastPosRef.current) return;
    const dx = x - lastPosRef.current.x;
    const dy = y - lastPosRef.current.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    lastPosRef.current = { x, y };
  };
  const endDrag = () => {
    setDragging(false);
    lastPosRef.current = null;
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(message.id);
    }
    setImageError(false);
  };

  if (!imageUrl) {
    return (
      <div className="text-yellow-400 flex items-center gap-2">
        ⚠️ No image available
      </div>
    );
  }

  return (
    <>
      {/* Inline bubble preview */}
      <div className="my-2 flex flex-col items-start">
        <div className="relative overflow-hidden rounded-2xl border border-gray-700 bg-dark-700">
          {/* Show local preview during upload */}
          {localPreview && isUploading && !uploadError && (
            <div className="relative">
              <img
                src={localPreview}
                alt="Uploading"
                className="h-40 w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="mt-2 text-sm text-white font-semibold">
                    {uploadProgress}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Show error state with retry */}
          {localPreview && uploadError && (
            <div className="relative">
              <img
                src={localPreview}
                alt="Upload failed"
                className="h-40 w-full object-cover opacity-60 blur-sm"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-800/50 rounded-xl">
                <span className="text-sm text-white mb-2">Upload failed</span>
                <button
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  onClick={handleRetry}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Show final uploaded image */}
          {imageUrl && !isUploading && !uploadError && (
            <>
              {imageError ? (
                <div className="flex h-40 w-full items-center justify-center bg-gray-800">
                  <X className="h-8 w-8 text-gray-500" />
                </div>
              ) : (
                <img
                  src={imageUrl}
                  alt="uploaded"
                  className="h-40 w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                  onError={(e) => {
                    handleImageError(e);
                  }}
                  onClick={openViewer}
                />
              )}
            </>
          )}

          {/* Legacy error overlay for backward compatibility */}
          {hasError && !uploadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <span className="text-sm text-red-400">Upload failed</span>
              <button
                onClick={handleRetry}
                className="mt-1 flex items-center gap-1 rounded-lg bg-[#B2BDA3] px-2 py-1 text-xs text-black transition-colors hover:bg-[#9BA88A]"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Caption */}
        {caption && (
          <p className="mt-2 text-sm text-gray-300 bg-gray-800/50 rounded-lg p-2">
            {caption}
          </p>
        )}
        
        {/* Status text */}
        <p className="mt-1 text-xs text-gray-400">
          {isUploading
            ? "Uploading..."
            : uploadError
            ? "Upload failed - click retry"
            : hasError
            ? "Retry required"
            : !imageUrl
            ? "No image available"
            : "1 image sent"}
        </p>
      </div>

      {/* Fullscreen viewer with premium features */}
      {showFullscreen && images.length > 0 && (
        <div
          ref={pinchRef}
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 overflow-hidden touch-none"
          onClick={closeViewer}
          onDoubleClick={handleDoubleTap}
          onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
          onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={(e) => {
            if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchEnd={(e) => {
            endDrag();
            // Handle double tap for zoom
            if (e.touches.length === 0) {
              handleDoubleTap();
            }
          }}
        >
          <img
            src={images[index].metadata?.imageUrl || images[index].content}
            alt="Full image"
            style={{
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transformOrigin: `${origin.x}px ${origin.y}px`,
              transition: dragging ? "none" : scale === 1 ? "transform 0.2s ease-out" : "none",
            }}
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-lg select-none cursor-grab active:cursor-grabbing"
          />

          {/* Close button */}
          <button
            onClick={closeViewer}
            className="absolute top-4 right-4 bg-white text-black px-3 py-1 rounded-lg shadow"
          >
            ✕
          </button>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-6 text-white text-3xl"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-6 text-white text-3xl"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}