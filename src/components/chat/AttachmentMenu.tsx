import { Camera, Image as ImageIcon, Mic, Paperclip } from "lucide-react";
import React, { useRef } from "react";
import { toast } from "sonner";

import { sendMessageWithAttachments } from "../../services/chatService";
import { imageService } from "../../services/imageService";
import { useMessageStore } from "../../stores/useMessageStore";

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  userId: string;
  onAddAttachment?: (attachment: any) => void; // New callback for adding to input area
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  conversationId,
  userId,
  onAddAttachment,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMessage = useMessageStore((state) => state.addMessage);


  if (!isOpen) return null;

  // 🔹 Upload handler - adds to input area for caption
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📂 File selected:", file.name, "size:", file.size);

    try {
      toast.loading("📤 Uploading file...");
      console.log("📤 Starting upload via imageService...");
      
      // Use the existing imageService for upload (now uses attachments bucket)
      const result = await imageService.uploadImage(file, userId);
      
      console.log("✅ Uploaded file:", result);
      console.log("🔗 Public URL:", result.publicUrl);

      // Create attachment object for input area
      const attachment = {
        type: file.type.startsWith('image/') ? "image" as const : "file" as const,
        url: result.publicUrl,
        publicUrl: result.publicUrl, // Keep both for compatibility
        name: file.name,
        size: file.size,
        file: file, // Keep original file for compatibility
      };

      // If we have the callback, add to input area instead of sending immediately
      if (onAddAttachment) {
        onAddAttachment(attachment);
        console.log("✅ File added to input area for caption");
        toast.dismiss();
        toast.success("✅ File added to input! Add a caption and send.");
      } else {
        // Fallback to old behavior if no callback provided
        await sendMessageWithAttachments(
          conversationId, 
          [attachment], 
          addMessage, 
          `Uploaded ${file.name}`,
          userId
        );
        console.log("✅ Message added to chat with attachment");
        toast.dismiss();
        toast.success("✅ File uploaded and added to chat!");
      }

    } catch (err) {
      console.error("❌ Upload failed:", err);
      toast.dismiss();
      toast.error("Upload failed - check console for details");
    } finally {
      onClose();
    }
  };

  return (
    <div 
      data-attachment-menu
      className="absolute bottom-24 left-4 w-80 bg-gray-800/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-gray-600/50 z-[9999] overflow-hidden"
    >
      {/* Hidden input (triggered programmatically) */}
      <input
        type="file"
        accept="image/*,application/pdf,audio/*"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-gray-600">
        <h3 className="text-base font-semibold text-white">Attach Media</h3>
        <p className="text-sm text-blue-100 mt-1">Choose what you'd like to share</p>
      </div>

      {/* Menu Items */}
      <div className="py-3">
        <button
          className="flex items-center w-full px-6 py-4 text-left hover:bg-gray-700/50 transition-colors duration-200 group"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <div className="flex-shrink-0 mr-4 group-hover:scale-110 transition-transform duration-200">
            <Paperclip className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="text-base font-medium text-gray-100 group-hover:text-white">
              Attach File
            </div>
            <div className="text-sm text-gray-400 group-hover:text-gray-300 mt-1">
              Upload documents, PDFs, and more
            </div>
          </div>
          <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          className="flex items-center w-full px-6 py-4 text-left hover:bg-gray-700/50 transition-colors duration-200 group"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <div className="flex-shrink-0 mr-4 group-hover:scale-110 transition-transform duration-200">
            <ImageIcon className="w-8 h-8 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="text-base font-medium text-gray-100 group-hover:text-white">
              Upload Image
            </div>
            <div className="text-sm text-gray-400 group-hover:text-gray-300 mt-1">
              Share photos and images
            </div>
          </div>
          <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          className="flex items-center w-full px-6 py-4 text-left hover:bg-gray-700/50 transition-colors duration-200 group"
          onClick={() => {
            console.log("📷 TODO: Camera capture");
          }}
        >
          <div className="flex-shrink-0 mr-4 group-hover:scale-110 transition-transform duration-200">
            <Camera className="w-8 h-8 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="text-base font-medium text-gray-100 group-hover:text-white">
              Take Photo
            </div>
            <div className="text-sm text-gray-400 group-hover:text-gray-300 mt-1">
              Capture with your camera
            </div>
          </div>
          <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          className="flex items-center w-full px-6 py-4 text-left hover:bg-gray-700/50 transition-colors duration-200 group"
          onClick={() => {
            console.log("🎤 TODO: Record audio");
          }}
        >
          <div className="flex-shrink-0 mr-4 group-hover:scale-110 transition-transform duration-200">
            <Mic className="w-8 h-8 text-red-600" />
          </div>
          <div className="flex-1">
            <div className="text-base font-medium text-gray-100 group-hover:text-white">
              Record Audio
            </div>
            <div className="text-sm text-gray-400 group-hover:text-gray-300 mt-1">
              Record voice messages
            </div>
          </div>
          <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-700/30 border-t border-gray-600">
        <p className="text-xs text-gray-400 text-center">
          Supported formats: Images, PDFs, Audio, Documents
        </p>
      </div>
    </div>
  );
};

export default AttachmentMenu;