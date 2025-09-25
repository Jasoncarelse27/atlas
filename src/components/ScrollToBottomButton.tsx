import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

export const ScrollToBottomButton = ({
  onClick,
  visible,
}: {
  onClick: () => void;
  visible: boolean;
}) => (
  <AnimatePresence>
    {visible && (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onClick={onClick}
        className="fixed bottom-20 right-6 p-3 rounded-full shadow-lg
                   bg-[#B2BDA3] hover:bg-[#A3B295] text-white transition
                   backdrop-blur-md z-50"
      >
        <ArrowDown className="w-6 h-6" />
      </motion.button>
    )}
  </AnimatePresence>
);
