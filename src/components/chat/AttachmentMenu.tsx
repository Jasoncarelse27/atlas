import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FileUp, Image as ImageIcon } from "lucide-react";
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
          {/* Positioned above the + button - Mobile friendly */}
          <motion.div
            data-attachment-menu
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 sm:w-80 max-w-[95vw] z-50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="rounded-3xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-2xl border border-slate-700/50"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="text-center mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Attach Media</h2>
                  <p className="text-white/70 text-xs sm:text-sm">Choose what you'd like to share</p>
                </div>

                {/* Hidden input (triggered programmatically) */}
                <input
                  type="file"
                  accept="*/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />

                {/* Options - Only Attach File and Upload Image */}
                <div className="space-y-2 sm:space-y-3">
                  {/* Attach File */}
                  <button
                    className="w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/60 transition-all duration-200 border border-slate-600/30 hover:border-slate-500/50 group"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-xl bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                        <FileUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium text-sm sm:text-base">Attach File</div>
                        <div className="text-slate-300 text-xs sm:text-sm">Upload documents, PDFs, and more</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                  </button>

                  {/* Upload Image */}
                  <button
                    className="w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/60 transition-all duration-200 border border-slate-600/30 hover:border-slate-500/50 group"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-600/20 group-hover:bg-emerald-600/30 transition-colors">
                        <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium text-sm sm:text-base">Upload Image</div>
                        <div className="text-slate-300 text-xs sm:text-sm">Share photos and images</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                  </button>
                </div>

                {/* Footer */}
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-600/30">
                  <p className="text-slate-400 text-xs text-center">
                    Supported formats: Images, PDFs, Audio, Documents
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttachmentMenu;