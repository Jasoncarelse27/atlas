import { useEffect, useRef, useState } from "react";

export const useAutoScroll = (deps: any[] = [], containerRef?: React.RefObject<HTMLDivElement | null>) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [shouldGlow, setShouldGlow] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
  
  // console.log('🔄 [useAutoScroll] Hook called with deps:', deps.length, 'items');

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      
      if (containerRef?.current) {
        // Container scroll
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
        
          // console.log('🔄 [useAutoScroll] Container scroll:', { scrollTop, scrollHeight, clientHeight, atBottom });
        setShowScrollButton(!atBottom);
        setIsAtBottom(atBottom);
      } else {
        // Window scroll fallback
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.body.offsetHeight;
        const atBottom = scrollTop + windowHeight >= documentHeight - 50;
        
          // console.log('🔄 [useAutoScroll] Window scroll:', { scrollTop, windowHeight, documentHeight, atBottom });
        setShowScrollButton(!atBottom);
        setIsAtBottom(atBottom);
      }
    };

    // Initial check
    handleScroll();

    // Listen to scroll events
    if (containerRef?.current) {
      containerRef.current.addEventListener("scroll", handleScroll);
    } else {
      window.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (containerRef?.current) {
        containerRef.current.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
    };
  }, [containerRef]);

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
        // console.log('🔄 [useAutoScroll] New message detected, isAtBottom:', isAtBottom);
        if (isAtBottom) {
          // User is at bottom → auto-scroll to new messages
          // console.log('🔄 [useAutoScroll] Auto-scrolling to bottom');
          scrollToBottom();
        } else {
          // User is scrolled up → trigger golden glow pulse
          // console.log('🔄 [useAutoScroll] User scrolled up, showing glow');
          setShouldGlow(true);
          const timeout = setTimeout(() => setShouldGlow(false), 1200);
          return () => clearTimeout(timeout);
        }
    }
  }, deps);

  return { bottomRef, scrollToBottom, showScrollButton, shouldGlow };
};
