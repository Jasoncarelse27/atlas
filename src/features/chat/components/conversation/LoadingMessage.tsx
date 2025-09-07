import React from "react";
import { Bot, Clock } from "lucide-react";
import LoadingSpinner from "../../../../components/LoadingSpinner";

export default function LoadingMessage() {
  return (
    <div className="rounded-xl p-4 bg-gray-800/90 border border-gray-700 shadow-md">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-800/80 rounded-full flex-shrink-0">
          <Bot className="w-4 h-4 text-purple-200" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-2">
            <span className="font-medium text-white mr-2">Atlas</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Now
            </span>
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <LoadingSpinner size="sm" />
            <span>Generating response...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
