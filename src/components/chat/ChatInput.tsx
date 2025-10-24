import { Send } from "lucide-react";
import { generateUUID } from "../utils/uuid";
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { sendMessageWithAttachments } from "../../services/chatService";
import { useMessageStore, type PendingAttachment } from "../../stores/useMessageStore";

interface ChatInputProps {
  conversationId: string;
  userId: string;
  onImageUpload?: (file: File) => void;
}

export default function ChatInput({ conversationId, userId, onImageUpload }: ChatInputProps) {
  const {
    pendingAttachments,
    addPendingAttachments,
    updatePendingAttachment,
    removePendingAttachment,
    clearPendingAttachments,
  } = useMessageStore();

  const [text, setText] = useState("");

  // Handle dropped files
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const attachments: PendingAttachment[] = acceptedFiles.map((file) => ({
        id: generateUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
      }));
      addPendingAttachments(attachments);
    },
    [addPendingAttachments]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "audio/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
    },
    noClick: true, // Don't trigger on click, only drag
  });

  const handleSend = async () => {
    if (!text.trim() && pendingAttachments.length === 0) return;

    try {
      // Handle image uploads first
      if (pendingAttachments.length > 0) {
        for (const attachment of pendingAttachments) {
          if (attachment.file.type.startsWith('image/')) {
            // Use the new image upload handler
            if (onImageUpload) {
              await onImageUpload(attachment.file);
            }
          } else {
            // For non-image files, use the old flow
            await sendMessageWithAttachments(conversationId, userId, {
              text: attachment.caption || "",
              attachments: [attachment],
            });
          }
        }
      }

      // Send text message if there's text
      if (text.trim()) {
        await sendMessageWithAttachments(conversationId, userId, {
          text,
          attachments: [],
        });
      }

      setText("");
      clearPendingAttachments();
    } catch (error) {
      // Error already handled upstream
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      {...getRootProps()}
      className={`border-t border-gray-700 ${
        isDragActive ? "bg-atlas-sage/20 border-atlas-sage" : ""
      }`}
    >
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-atlas-sage/20 border-2 border-dashed border-atlas-sage rounded-lg flex items-center justify-center z-10">
          <p className="text-atlas-sage text-lg font-medium">
            Drop files here to attach them
          </p>
        </div>
      )}

      {/* Inline previews with captions */}
      {pendingAttachments.length > 0 && (
        <div className="p-3 border-b border-gray-700">
          <div className="flex flex-col gap-3">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="relative p-3 border border-gray-600 rounded-lg bg-gray-800/40"
              >
                {/* File preview */}
                <div className="flex items-start gap-3">
                  {att.file.type.startsWith("image/") && (
                    <img
                      src={att.previewUrl}
                      alt="preview"
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  
                  {att.file.type.startsWith("audio/") && (
                    <div className="w-16 h-16 bg-purple-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs">🎵</span>
                    </div>
                  )}
                  
                  {att.file.type.includes("pdf") && (
                    <div className="w-16 h-16 bg-red-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs">📄</span>
                    </div>
                  )}
                  
                  {att.file.type.includes("word") && (
                    <div className="w-16 h-16 bg-atlas-sage rounded flex items-center justify-center">
                      <span className="text-white text-xs">📝</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <p className="text-sm text-gray-300 mb-2">{att.file.name}</p>
                    
                    {/* Caption input */}
                    <input
                      type="text"
                      placeholder={`Add a caption for ${att.file.name}...`}
                      value={att.caption || ""}
                      onChange={(e) =>
                        updatePendingAttachment(att.id, { caption: e.target.value })
                      }
                      className="w-full bg-transparent border-b border-gray-600 text-white text-sm p-1 outline-none focus:border-atlas-sage"
                    />
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePendingAttachment(att.id);
                  }}
                  className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Atlas anything..."
              className="w-full bg-transparent outline-none text-white resize-none min-h-[40px] max-h-32"
              rows={1}
              style={{
                height: "auto",
                minHeight: "40px",
              }}
              ref={(textarea) => {
                if (textarea) {
                  textarea.style.height = "auto";
                  textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
                }
              }}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!text.trim() && pendingAttachments.length === 0}
            className="px-4 py-2 bg-atlas-sage hover:bg-atlas-success disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
