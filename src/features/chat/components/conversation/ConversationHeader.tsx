import React from "react";
import { MessageSquare, Edit3, Check, X } from "lucide-react";

interface ConversationHeaderProps {
  title: string;
  isEditing: boolean;
  editedTitle: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onTitleChange: (title: string) => void;
}

export default function ConversationHeader({
  title,
  isEditing,
  editedTitle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onTitleChange,
}: ConversationHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:border-blue-500"
            placeholder="Enter conversation title"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSaveEdit();
              } else if (e.key === "Escape") {
                onCancelEdit();
              }
            }}
          />
          <button
            onClick={onSaveEdit}
            className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Check className="w-5 h-5" />
          </button>
          <button
            onClick={onCancelEdit}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            {title}
          </h2>
          <button
            onClick={onStartEdit}
            className="p-1.5 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
