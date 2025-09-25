import { useEffect, useRef, useState } from "react";

export const useAutoScroll = (deps: any[] = []) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 50;
      setShowScrollButton(!atBottom);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, deps);

  return { bottomRef, scrollToBottom, showScrollButton };
};
