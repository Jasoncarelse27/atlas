import { saveMessage, type Message } from "@/features/chat/storage";
import { supabase } from "@/lib/supabase";
import { useMessageStore, type Message as StoreMessage } from "@/stores/useMessageStore";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Image, Paperclip, PlusCircle } from "lucide-react";
import React, { useState } from "react";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);

  /** Toggle the drawer open/closed */
  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
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
    }
    closeDrawer();
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Toggle Button */}
      <motion.button
        onClick={toggleDrawer}
        className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-gray-400"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle quick actions"
      >
        <motion.div
          animate={{ rotate: isDrawerOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <PlusCircle className="w-5 h-5 text-gray-600" />
        </motion.div>
      </motion.button>

      {/* Action Buttons */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2 bg-white rounded-lg shadow-lg p-2 border border-gray-200"
          >
            <motion.button
              onClick={handleVoiceAction}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Mic className="w-4 h-4" />
              Voice
            </motion.button>
            <motion.button
              onClick={handleImageAction}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Image className="w-4 h-4" />
              Image
            </motion.button>
            <motion.button
              onClick={handleFileAction}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Paperclip className="w-4 h-4" />
              File
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AtlasDrawerInterface;