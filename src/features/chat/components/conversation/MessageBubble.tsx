import React from "react";
import {
  Bot,
  User,
  Clock,
  Copy,
  Check,
  Trash2,
  Share2,
  Bookmark,
} from "lucide-react";
import type { Message } from "../../../../types/chat";

interface MessageBubbleProps {
  message: Message;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

export default function MessageBubble({
  message,
  copiedId,
  onCopy,
  onDelete,
}: MessageBubbleProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={`rounded-xl p-4 ${
        message.role === "user"
          ? "bg-blue-900/40 border border-blue-800/80 shadow-md"
          : "bg-gray-800/90 border border-gray-700 shadow-md"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`p-2 rounded-full flex-shrink-0 ${
            message.role === "user" ? "bg-blue-800/80" : "bg-purple-800/80"
          }`}
        >
          {message.role === "user" ? (
            <User className="w-4 h-4 text-blue-200" />
          ) : (
            <Bot className="w-4 h-4 text-purple-200" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {message.role === "user" ? "You" : "Atlas"}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimestamp(message.timestamp)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onCopy(message.id, message.content)}
                className="p-1 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-700"
              >
                {copiedId === message.id ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {onDelete && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Message Content */}
          <div className="text-gray-200 whitespace-pre-wrap">
            {message.content}
          </div>

          {/* Action Buttons */}
          {message.role === "assistant" && (
            <div className="mt-4 flex items-center gap-2">
              <button className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors border border-gray-600/80">
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>

              <button className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-xs flex items-center gap-1 transition-colors border border-gray-600/80">
                <Bookmark className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
