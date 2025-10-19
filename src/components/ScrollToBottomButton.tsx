import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

export const ScrollToBottomButton = ({
  onClick,
  visible,
  shouldGlow = false, // Keep for backward compatibility but not used
}: {
  onClick: () => void;
  visible: boolean;
  shouldGlow?: boolean;
}) => {
  // Suppress unused variable warning
  void shouldGlow;
  
  return (
  <AnimatePresence mode="wait">
    {visible && (
      <motion.button
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ 
          duration: 0.3, 
          ease: "easeInOut",
          opacity: { duration: 0.25 }
        }}
        onClick={onClick}
        className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 p-3 rounded-full 
                   bg-[#B2BDA3]/90 hover:bg-[#A3B295] 
                   border border-[#B2BDA3]/30 hover:border-[#B2BDA3]/50
                   text-white transition-all duration-200
                   backdrop-blur-sm z-40
                   shadow-lg hover:shadow-xl
                   active:scale-95 touch-manipulation
                   min-w-[44px] min-h-[44px] flex items-center justify-center"
        style={{ 
          WebkitTapHighlightColor: 'transparent',
          willChange: 'transform, opacity'
        }}
        aria-label="Scroll to bottom"
      >
        <ArrowDown className="w-5 h-5" strokeWidth={2.5} />
      </motion.button>
    )}
  </AnimatePresence>
  );
};
