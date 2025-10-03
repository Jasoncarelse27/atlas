import { motion } from "framer-motion";

const dotVariants = {
  animate: {
    y: [0, -6, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex items-start space-x-3"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="flex-1 max-w-3xl">
        <div className="px-4 py-3 bg-gradient-to-br from-[#B2BDA3]/10 to-[#F4E5D9]/10 border border-[#B2BDA3]/20 rounded-2xl rounded-bl-md">
          <div className="flex space-x-1">
            <motion.span
              className="w-2 h-2 bg-[#B2BDA3] rounded-full"
              variants={dotVariants}
              animate="animate"
              transition={{ delay: 0 }}
            />
            <motion.span
              className="w-2 h-2 bg-[#B2BDA3] rounded-full"
              variants={dotVariants}
              animate="animate"
              transition={{ delay: 0.2 }}
            />
            <motion.span
              className="w-2 h-2 bg-[#B2BDA3] rounded-full"
              variants={dotVariants}
              animate="animate"
              transition={{ delay: 0.4 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
