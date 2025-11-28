import { useCallback, useEffect, useRef, useState } from "react";

export const useAutoScroll = (deps: any[] = [], containerRef?: React.RefObject<HTMLDivElement | null>) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [shouldGlow, setShouldGlow] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);

  // ✅ FIX: Memoize scrollToBottom to prevent recreation on every render
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef?.current;
    if (!container) {
      // Fallback to bottomRef if containerRef not available
      bottomRef.current?.scrollIntoView({ behavior });
      return;
    }

    // ✅ FIX: Use double RAF for better reliability on mobile/web
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
      });
    });
  }, [containerRef]);

  // FIXED: Proper scroll detection
  useEffect(() => {
    const checkScroll = () => {
      if (!containerRef?.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Show button when scrolled up more than 100px from bottom
      setShowScrollButton(distanceFromBottom > 100);
      setIsAtBottom(distanceFromBottom < 50);
    };
    
    // Check immediately and after a delay (for content loading)
    checkScroll();
    const timer = setTimeout(checkScroll, 500);
    
    // Add scroll listener
    const element = containerRef?.current;
    if (element) {
      element.addEventListener('scroll', checkScroll, { passive: true });
      // Also listen for resize/content changes
      window.addEventListener('resize', checkScroll);
    }
    
    return () => {
      clearTimeout(timer);
      if (element) {
        element.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, [containerRef, deps]); // Re-run when deps change too

  // Initial scroll to bottom on page load/refresh
  // ✅ FIX: Handle new users with 0 messages - don't try to scroll empty containers
  useEffect(() => {
    if (!hasInitiallyScrolled && containerRef?.current) {
      const container = containerRef.current;
      const hasScrollableContent = container.scrollHeight > container.clientHeight;
      const messageCount = Array.isArray(deps) && deps.length > 0 ? deps[0] : 0;
      
      // ✅ FIX: Only attempt scroll if there's actual content OR if we have messages
      // For new users with 0 messages, just mark as scrolled to prevent future attempts
      if (hasScrollableContent || messageCount > 0) {
        // Force scroll to bottom on initial load with multiple attempts
        const scrollAttempts = [100, 300, 500]; // Try at different intervals
        const timers: NodeJS.Timeout[] = [];
        
        scrollAttempts.forEach((delay) => {
          const timer = setTimeout(() => {
            // ✅ FIX: Double-check container still exists and has content before scrolling
            if (containerRef?.current && containerRef.current.scrollHeight > containerRef.current.clientHeight) {
              scrollToBottom();
            }
          }, delay);
          timers.push(timer);
        });
        
        const finalTimer = setTimeout(() => {
          setHasInitiallyScrolled(true);
        }, 600);
        timers.push(finalTimer);
        
        // ✅ MEMORY LEAK FIX: Cleanup all timers
        return () => {
          timers.forEach(timer => clearTimeout(timer));
        };
      } else {
        // ✅ FIX: For new users with no messages, mark as scrolled immediately
        // This prevents scroll attempts on empty containers
        setHasInitiallyScrolled(true);
      }
    } else if (!hasInitiallyScrolled && !containerRef?.current) {
      // ✅ FIX: If container not ready yet, mark as scrolled after short delay
      // Prevents infinite waiting for container that might never exist
      const timer = setTimeout(() => {
        setHasInitiallyScrolled(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [deps, hasInitiallyScrolled, scrollToBottom, containerRef]);

  // Handle new messages after initial load
  // ✅ FIX: Only auto-scroll if there are actual messages (not empty state)
  useEffect(() => {
    if (hasInitiallyScrolled && containerRef?.current) {
      const messageCount = Array.isArray(deps) && deps.length > 0 ? deps[0] : 0;
      const hasScrollableContent = containerRef.current.scrollHeight > containerRef.current.clientHeight;
      
      // ✅ FIX: Only attempt scroll if we have messages AND scrollable content
      if (messageCount > 0 && hasScrollableContent) {
        if (isAtBottom) {
          // User is at bottom → auto-scroll to new messages
          scrollToBottom();
        } else {
          // User is scrolled up → trigger golden glow pulse
          setShouldGlow(true);
          const timeout = setTimeout(() => setShouldGlow(false), 1200);
          return () => clearTimeout(timeout);
        }
      }
    }
  }, [hasInitiallyScrolled, isAtBottom, scrollToBottom, deps, containerRef]);

  return { bottomRef, scrollToBottom, showScrollButton, shouldGlow };
};
