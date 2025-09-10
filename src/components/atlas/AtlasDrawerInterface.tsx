import { saveMessage, type Message } from "@/features/chat/storage";
import { supabase } from "@/lib/supabase";
import { useMessageStore, type Message as StoreMessage } from "@/stores/useMessageStore";
import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";

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
    <div className="relative p-4 bg-white border-2 border-red-500 min-h-[200px]">
      <h2 className="text-xl font-bold mb-4 text-black">Atlas Drawer Interface</h2>
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="p-4 rounded-full bg-blue-500 hover:bg-blue-600 transition text-white text-2xl font-bold"
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
            className="absolute bottom-16 left-0 flex flex-col gap-2 bg-white shadow-lg rounded-xl p-3 border-2 border-green-500"
          >
            <button
              onClick={handleVoiceAction}
              className="px-6 py-3 rounded-md bg-green-500 hover:bg-green-600 transition text-white font-bold"
            >
              🎤 Voice
            </button>
            <button
              onClick={handleImageAction}
              className="px-6 py-3 rounded-md bg-green-500 hover:bg-green-600 transition text-white font-bold"
            >
              🖼️ Image
            </button>
            <button
              onClick={handleFileAction}
              className="px-6 py-3 rounded-md bg-green-500 hover:bg-green-600 transition text-white font-bold"
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