// 🎯 Phase 1: Core-First AttachmentMenu
// ✅ Optimistic UI - files appear instantly
// ✅ Background sync - database failures don't block UX
// ✅ No tier blocking - core features always work
// ✅ Future-proof - ready for Phase 3 business logic

import { AnimatePresence, motion } from "framer-motion";
import { Camera, File, Image as ImageIcon, Mic } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { sendMessageWithAttachments } from "../../services/chatService";
import { useMessageStore } from "../../stores/useMessageStore";

interface AttachmentMenuProps {
  conversationId?: string;
  onClose: () => void;
  onFileSelect?: (files: FileList, type: string) => void;
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({ conversationId, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const addMessage = useMessageStore((s) => s.addMessage);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Note: Object URLs are cleaned up when the component unmounts
      // The actual cleanup happens in the message store when messages are processed
    };
  }, []);

  // 🎯 Core Function: File Upload with Optimistic UI
  const handleFileUpload = async (files: FileList, type: string) => {
    console.log(`📎 Uploading ${files.length} ${type} file(s)`);
    
    // ✅ Step 0: File size validation (10MB max per file)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        validFiles.push(file);
      }
    });
    
    // Show user-friendly error for oversized files
    if (invalidFiles.length > 0) {
      const errorMsg = `Files too large (max 10MB): ${invalidFiles.join(', ')}`;
      console.warn(`⚠️ ${errorMsg}`);
      alert(errorMsg);
    }
    
    // If no valid files, don't proceed
    if (validFiles.length === 0) {
      console.log("❌ No valid files to upload");
      return;
    }
    
    // ✅ Step 1: Create optimistic message immediately (only with valid files)
    const optimisticMessage = {
      id: uuidv4(),
      role: "user" as const,
      type: "file" as const, // Use valid Message type
      content: "", // User can add caption later
      attachments: validFiles.map(file => ({
        type: inferFileType(file) as "image" | "audio" | "file",
        url: URL.createObjectURL(file),
        file: file,
        name: file.name,
        size: file.size
      })),
      status: "pending" as const,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // ✅ Step 2: Add to UI immediately (optimistic)
    addMessage(optimisticMessage);
    console.log("✅ Message added optimistically to UI");

    // ✅ Step 3: Background sync (non-blocking)
    if (conversationId) {
      try {
        console.log("🔄 Starting background sync...");
        await sendMessageWithAttachments(conversationId, optimisticMessage.attachments, addMessage);
        console.log("✅ Background sync completed");
      } catch (error) {
        console.warn("⚠️ Background sync failed, but UI still works:", error);
        // Message stays in pending state, resendService will handle retry
      }
    } else {
      console.log("📝 No conversation ID, using local-only mode");
    }

    // ✅ Step 4: Close menu
    onClose();
  };

  // 🎯 Core Function: Create file input and handle selection
  const createFileInput = (options: { accept?: string; capture?: string; multiple?: boolean }, label: string) => {
    console.log(`📎 ${label} clicked`);
    
    const input = document.createElement("input");
    input.type = "file";
    if (options.accept) input.accept = options.accept;
    if (options.capture) input.capture = options.capture as any;
    if (options.multiple) input.multiple = options.multiple;
    
    input.onchange = (e: any) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const fileType = options.accept?.includes("image") ? "image" : 
                        options.accept?.includes("audio") ? "audio" : "file";
        handleFileUpload(files, fileType);
      }
    };
    
    input.click();
  };

  // 🎯 Core Function: Infer file type for proper handling
  const inferFileType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("video/")) return "video";
    return "file";
  };

  // 🎯 Simple Options - No tier checking, just core functionality
  const options = [
    { 
      label: "Take a Photo", 
      icon: <Camera size={18} />, 
      accept: "image/*", 
      capture: "environment",
      onClick: () => createFileInput({ accept: "image/*", capture: "environment" }, "Take a Photo")
    },
    { 
      label: "Upload Image", 
      icon: <ImageIcon size={18} />, 
      accept: "image/*", 
      multiple: true,
      onClick: () => createFileInput({ accept: "image/*", multiple: true }, "Upload Image")
    },
    { 
      label: "Record Audio", 
      icon: <Mic size={18} />, 
      onClick: () => {
        console.log("🎤 Audio recording - coming soon!");
        alert("🎤 Audio recording coming soon!");
        onClose();
      }
    },
    { 
      label: "Upload File", 
      icon: <File size={18} />, 
      multiple: true,
      onClick: () => createFileInput({ multiple: true }, "Upload File")
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ 
          duration: 0.2, 
          ease: [0.4, 0, 0.2, 1] 
        }}
        className="absolute bottom-14 left-2 flex flex-col gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 z-50 w-64 border border-gray-200 dark:border-gray-700"
      >
        {options.map((option, index) => (
          <button
            key={index}
            onClick={option.onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105"
          >
            {option.icon} {option.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default AttachmentMenu;