import { AnimatePresence, motion } from "framer-motion";
import { FileUp, Image as ImageIcon } from "lucide-react";
import React, { useRef } from "react";
import { toast } from "sonner";

// Removed sendMessageWithAttachments import - using callback pattern instead
import { imageService } from "../../services/imageService";
// Removed useMessageStore import - using callback pattern instead

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string; // Made optional since we're using callback pattern
  userId: string;
  onAddAttachment?: (attachment: any) => void; // New callback for adding to input area
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  userId,
  onAddAttachment,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Removed useMessageStore - using onAddAttachment callback instead

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
            console.log("⚠️ No onAddAttachment callback provided - file uploaded but not added to chat");
            toast.dismiss();
            toast.success("✅ File uploaded! Please add a caption and send.");
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Menu - positioned above the plus button with glass effect */}
          <motion.div
            data-attachment-menu
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 max-w-[90vw] rounded-2xl bg-white/25 backdrop-blur-md shadow-xl border border-white/20 z-50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <h3 className="text-white/90 font-semibold text-base mb-1">Attach Media</h3>
              <p className="text-white/60 text-sm mb-4">
                Choose what you'd like to share
              </p>

              {/* Hidden input (triggered programmatically) */}
              <input
                type="file"
                accept="image/*,application/pdf,audio/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              <div className="flex flex-col space-y-3">
                <button
                  className="flex items-center p-3 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 transition-all duration-200 cursor-pointer border border-white/15 hover:border-white/25"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <FileUp className="w-5 h-5 text-blue-400 mr-3" />
                  <span className="text-white text-sm">Attach File</span>
                </button>

                <button
                  className="flex items-center p-3 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 transition-all duration-200 cursor-pointer border border-white/15 hover:border-white/25"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <ImageIcon className="w-5 h-5 text-green-400 mr-3" />
                  <span className="text-white text-sm">Upload Image</span>
                </button>
              </div>

              <p className="text-white/40 text-xs mt-4">
                Supported: Images, PDFs, Audio, Documents
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttachmentMenu;