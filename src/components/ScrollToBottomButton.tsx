import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

export const ScrollToBottomButton = ({
  onClick,
  visible,
  shouldGlow = false,
}: {
  onClick: () => void;
  visible: boolean;
  shouldGlow?: boolean;
}) => (
    <AnimatePresence>
      {visible && (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onClick={onClick}
        className={`fixed bottom-32 right-6 p-3 rounded-full shadow-lg
                   bg-[#B2BDA3] hover:bg-[#A3B295] text-white transition
                   backdrop-blur-md z-[9999]
                   ${shouldGlow ? "animate-pulse shadow-blue-400 shadow-lg" : ""}`}
      >
        <ArrowDown className="w-6 h-6" />
      </motion.button>
    )}
  </AnimatePresence>
);
