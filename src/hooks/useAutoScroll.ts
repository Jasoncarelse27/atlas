import { useEffect, useRef, useState } from "react";

export const useAutoScroll = (deps: any[] = [], containerRef?: React.RefObject<HTMLDivElement | null>) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [shouldGlow, setShouldGlow] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
  useEffect(() => {
    if (!hasInitiallyScrolled && deps.length > 0) {
      // Force scroll to bottom on initial load with multiple attempts
      const scrollAttempts = [100, 300, 500]; // Try at different intervals
      
      scrollAttempts.forEach((delay) => {
        setTimeout(() => {
          scrollToBottom();
        }, delay);
      });
      
      setTimeout(() => {
        setHasInitiallyScrolled(true);
      }, 600);
    }
  }, [deps, hasInitiallyScrolled]);

  // Handle new messages after initial load
  useEffect(() => {
    if (hasInitiallyScrolled && deps.length > 0) {
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
  }, deps);

  return { bottomRef, scrollToBottom, showScrollButton, shouldGlow };
};
