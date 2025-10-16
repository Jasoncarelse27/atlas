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
  <AnimatePresence>
    {visible && (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={onClick}
        className="fixed bottom-32 right-6 p-3 rounded-full 
                   bg-[#B2BDA3]/90 hover:bg-[#A3B295] 
                   border border-[#B2BDA3]/30 hover:border-[#B2BDA3]/50
                   text-white transition-all duration-200
                   backdrop-blur-sm z-[9999]
                   shadow-sm hover:shadow-md
                   active:scale-95"
      >
        <ArrowDown className="w-5 h-5" />
      </motion.button>
    )}
  </AnimatePresence>
  );
};
