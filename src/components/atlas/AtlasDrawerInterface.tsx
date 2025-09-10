import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveMessage, type Message } from "@/features/chat/storage";
import { supabase } from "@/lib/supabase";
import { useMessageStore, type Message as StoreMessage } from "@/stores/useMessageStore";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);

  /** Toggle the drawer open/closed */
  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => {
      const newState = !prev;
      console.log("Drawer state toggled:", newState ? "OPEN" : "CLOSED");
      return newState;
    });
  };

  /** Close drawer helper */
  const closeDrawer = () => setIsDrawerOpen(false);

  /** Placeholder actions */
  const handleVoiceAction = async () => {
    const message: StoreMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: "[VOICE] Voice message placeholder",
      createdAt: new Date().toISOString(),
    };
    console.log("Voice message added to store ✅");
    addMessage(message);
    
    // Save to local storage
    const storageMessage: Message = {
      id: message.id,
      role: "user" as const,
      content: message.content,
      created_at: message.createdAt,
    };
    await saveMessage(storageMessage);
    
    // Sync to Supabase
    if (supabase) {
      await supabase.from("messages").insert(storageMessage);
      console.log("Voice message synced to Supabase ✅");
    }
    closeDrawer();
  };

  const handleImageAction = async () => {
    const message: StoreMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: "[IMAGE] Image message placeholder",
      createdAt: new Date().toISOString(),
    };
    console.log("Image message added to store ✅");
    addMessage(message);
    
    // Save to local storage
    const storageMessage: Message = {
      id: message.id,
      role: "user" as const,
      content: message.content,
      created_at: message.createdAt,
    };
    await saveMessage(storageMessage);
    
    // Sync to Supabase
    if (supabase) {
      await supabase.from("messages").insert(storageMessage);
      console.log("Image message synced to Supabase ✅");
    }
    closeDrawer();
  };

  const handleFileAction = async () => {
    const message: StoreMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: "[FILE] File message placeholder",
      createdAt: new Date().toISOString(),
    };
    console.log("File message added to store ✅");
    addMessage(message);
    
    // Save to local storage
    const storageMessage: Message = {
      id: message.id,
      role: "user" as const,
      content: message.content,
      created_at: message.createdAt,
    };
    await saveMessage(storageMessage);
    
    // Sync to Supabase
    if (supabase) {
      await supabase.from("messages").insert(storageMessage);
      console.log("File message synced to Supabase ✅");
    }
    closeDrawer();
  };

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
      >
        {isDrawerOpen ? "×" : "+"}
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-12 left-0 flex flex-col gap-2 bg-white shadow-lg rounded-xl p-3"
          >
            <button
              onClick={handleVoiceAction}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
            >
              🎤 Voice
            </button>
            <button
              onClick={handleImageAction}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
            >
              🖼️ Image
            </button>
            <button
              onClick={handleFileAction}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
            >
              📎 File
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AtlasDrawerInterface;