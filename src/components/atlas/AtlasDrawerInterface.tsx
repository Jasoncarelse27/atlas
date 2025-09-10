import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Image, Paperclip, PlusCircle } from "lucide-react";
import { useMessageStore } from "@/stores/useMessageStore";
import { saveMessage, loadMessages } from "@/features/chat/storage"; // ✅ Supabase helpers

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);
  const clearMessages = useMessageStore((state) => state.clearMessages);

  // 🔄 Load messages from Supabase on mount
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await loadMessages();
        clearMessages(); // reset local first
        data.forEach((msg) => addMessage(msg));
        console.log("✅ Messages loaded from Supabase:", data);
      } catch (err) {
        console.error("❌ Failed to load messages from Supabase:", err);
      }
    };
    fetchMessages();
  }, [addMessage, clearMessages]);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
    console.log("Drawer state toggled:", !isDrawerOpen ? "OPEN" : "CLOSED");
  };

  const handleActionClick = async (type: "VOICE" | "IMAGE" | "FILE") => {
    const newMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: `[${type}] placeholder`,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    addMessage(newMessage);
    console.log("Message added locally:", newMessage);

    try {
      await saveMessage(newMessage);
      console.log("✅ Message saved to Supabase:", newMessage);
    } catch (err) {
      console.error("❌ Failed to save message to Supabase:", err);
    }

    // Auto-close drawer
    setIsDrawerOpen(false);
  };

  return (
    <div className="p-4">
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="flex items-center px-3 py-2 rounded-full bg-gray-100 shadow hover:bg-gray-200 transition"
      >
        <PlusCircle className="mr-2 h-5 w-5" />
        Toggle Drawer
      </button>

      {/* Drawer with Animation */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex space-x-2 rounded-xl bg-white p-4 shadow-lg"
          >
            <button
              onClick={() => handleActionClick("VOICE")}
              className="flex items-center space-x-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <Mic className="h-4 w-4" /> <span>Voice</span>
            </button>
            <button
              onClick={() => handleActionClick("IMAGE")}
              className="flex items-center space-x-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <Image className="h-4 w-4" /> <span>Image</span>
            </button>
            <button
              onClick={() => handleActionClick("FILE")}
              className="flex items-center space-x-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <Paperclip className="h-4 w-4" /> <span>File</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AtlasDrawerInterface;