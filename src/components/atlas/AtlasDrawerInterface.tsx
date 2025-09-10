import { useState } from "react";
import { useMessageStore } from "@/stores/useMessageStore";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Image, Paperclip, PlusCircle } from "lucide-react";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
    console.log("Drawer state toggled:", !isDrawerOpen ? "OPEN" : "CLOSED");
  };

  const handleActionClick = (type: "VOICE" | "IMAGE" | "FILE") => {
    const newMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: `[${type}] ${type.toLowerCase()} message placeholder`,
      createdAt: new Date().toISOString(),
    };
    addMessage(newMessage);
    console.log("Message added:", newMessage);
    setIsDrawerOpen(false); // Auto-close drawer
  };

  return (
    <div className="relative p-4">
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-full bg-white shadow hover:bg-gray-50 transition"
      >
        <PlusCircle className="w-5 h-5 text-gray-600" />
        <span className="text-gray-700 font-medium">Toggle Drawer</span>
      </button>

      {/* Drawer with Animations */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute mt-4 flex space-x-3 bg-white border border-gray-200 rounded-xl shadow-lg p-4"
          >
            {/* Voice Button */}
            <button
              onClick={() => handleActionClick("VOICE")}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            >
              <Mic className="w-4 h-4 text-gray-700" />
              <span className="text-sm text-gray-700">Voice</span>
            </button>

            {/* Image Button */}
            <button
              onClick={() => handleActionClick("IMAGE")}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            >
              <Image className="w-4 h-4 text-gray-700" />
              <span className="text-sm text-gray-700">Image</span>
            </button>

            {/* File Button */}
            <button
              onClick={() => handleActionClick("FILE")}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            >
              <Paperclip className="w-4 h-4 text-gray-700" />
              <span className="text-sm text-gray-700">File</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AtlasDrawerInterface;