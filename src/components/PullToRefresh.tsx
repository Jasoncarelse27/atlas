import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Pull-to-refresh component for mobile-friendly refresh gesture
 * Works on both touch devices and with mouse drag
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  disabled = false,
  className = ''
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  
  // Determine if we're at the top of scroll
  const isAtTop = useCallback(() => {
    if (!containerRef.current) return false;
    const scrollTop = containerRef.current.scrollTop;
    return scrollTop <= 0;
  }, []);
  
  // Handle touch/mouse start
  const handleStart = useCallback((clientY: number) => {
    if (disabled || isRefreshing || !isAtTop()) return;
    
    startYRef.current = clientY;
    currentYRef.current = clientY;
    setIsDragging(true);
  }, [disabled, isRefreshing, isAtTop]);
  
  // Handle touch/mouse move
  const handleMove = useCallback((clientY: number) => {
    if (!isDragging || isRefreshing) return;
    
    currentYRef.current = clientY;
    const distance = currentYRef.current - startYRef.current;
    
    // Only track downward pulls when at top
    if (distance > 0 && isAtTop()) {
      // Apply resistance to pull
      const resistance = 0.5;
      const resistedDistance = distance * resistance;
      setPullDistance(Math.min(resistedDistance, threshold * 2));
    }
  }, [isDragging, isRefreshing, isAtTop, threshold]);
  
  // Handle touch/mouse end
  const handleEnd = useCallback(async () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Trigger refresh if threshold met
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Lock at threshold during refresh
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('[PullToRefresh] Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isDragging, pullDistance, threshold, isRefreshing, onRefresh]);
  
  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientY);
  }, [handleStart]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientY);
  }, [handleMove]);
  
  // Mouse event handlers (for testing on desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  }, [handleStart]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientY);
  }, [handleMove]);
  
  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);
  
  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Calculate visual states
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;
  const opacity = Math.min(progress, 1);
  const scale = 0.8 + (progress * 0.2);
  
  return (
    <div className={`relative h-full overflow-hidden ${className}`}>
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            className="absolute inset-x-0 top-0 z-10 flex justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity }}
            exit={{ opacity: 0 }}
            style={{
              transform: `translateY(${pullDistance}px)`
            }}
          >
            <motion.div
              className="mt-4 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg"
              animate={{
                scale,
                rotate: isRefreshing ? 360 : rotation
              }}
              transition={{
                rotate: isRefreshing ? {
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear"
                } : {
                  duration: 0
                }
              }}
            >
              <RefreshCw 
                className={`w-5 h-5 ${
                  isRefreshing 
                    ? 'text-atlas-sage' 
                    : pullDistance >= threshold 
                      ? 'text-atlas-sage' 
                      : 'text-gray-400'
                }`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overscroll-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleMouseDown}
        style={{
          transform: isRefreshing ? `translateY(${threshold}px)` : `translateY(${pullDistance}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
