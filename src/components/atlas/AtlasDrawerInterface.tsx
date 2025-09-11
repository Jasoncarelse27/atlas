// 🧪 TEMPORARY DEBUG CODE: All console.log statements and debug UI will be removed in cleanup phase
import { saveMessage } from "@/features/chat/storage";
import { useSupabaseMessages } from "@/hooks/useSupabaseMessages";
import { useMessageStore, type Message } from "@/stores/useMessageStore";
import { AnimatePresence, motion } from "framer-motion";
import { Image, Mic, Paperclip, PlusCircle } from "lucide-react";
import React, { useState } from "react";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);
  const { loading, error } = useSupabaseMessages();

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const handleAction = async (type: Message["type"]) => {
    const newMsg: Message = {
      id: crypto.randomUUID(),
      type,
      content: `[${type}] test message placeholder`,
      sender: "user",
      created_at: new Date().toISOString(),
    };

    // optimistic update
    addMessage(newMsg);

    // save to supabase
    try {
      await saveMessage(newMsg);
      console.log("✅ Message inserted:", newMsg);
    } catch (err) {
      console.error("❌ Failed to insert message:", err);
    }

    setIsDrawerOpen(false);
  };

  return (
    <div className="relative">
      {/* Drawer Toggle */}
        <button
        onClick={toggleDrawer}
        className="p-2 rounded-full bg-blue-500 text-white"
      >
        <PlusCircle />
            </button>

      {/* Drawer Content */}
        <AnimatePresence>
        {isDrawerOpen && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 bg-white shadow-lg p-4 rounded-t-2xl"
          >
            <div className="flex justify-around">
              <button
                onClick={() => handleAction("VOICE")}
                className="p-2 rounded-full bg-gray-100"
              >
                <Mic />
                  </button>
                  <button
                onClick={() => handleAction("IMAGE")}
                className="p-2 rounded-full bg-gray-100"
                  >
                <Image />
                  </button>
                  <button
                onClick={() => handleAction("FILE")}
                className="p-2 rounded-full bg-gray-100"
              >
                <Paperclip />
                  </button>
                </div>
              </motion.div>
          )}
        </AnimatePresence>

      {/* 🧪 Debug Panel */}
      <div className="p-2 text-xs bg-gray-100 border-t mt-4">
        <p>🧪 Debug:</p>
        <p>Loading: {loading ? "true" : "false"}</p>
        <p>Error: {error || "none"}</p>
        <p>
          Messages: {useMessageStore.getState().messages.length}
        </p>
      </div>

      {/* 🧪 Messages List */}
      <ul className="p-2 text-sm">
        {useMessageStore.getState().messages.map((msg) => (
          <li key={msg.id} className="border-b py-1">
            <strong>{msg.type}</strong>: {msg.content}{" "}
            <em>({msg.sender})</em>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AtlasDrawerInterface;