import { useMessageStore } from "@/stores/useMessageStore";
import { PlusCircle } from "lucide-react";
import React, { useState } from "react";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);
  const clearMessages = useMessageStore((state) => state.clearMessages);
  const messages = useMessageStore((state) => state.messages);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
    console.log("Drawer state toggled:", isDrawerOpen ? "CLOSED" : "OPEN");
  };

  const handleActionClick = (type: "VOICE" | "IMAGE" | "FILE") => {
    const newMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: `[${type}] ${type.toLowerCase()} message placeholder`,
      createdAt: new Date().toISOString(),
    };
    addMessage(newMessage);
    console.log("Message added:", newMessage);
    setIsDrawerOpen(false);
  };

  return (
    <div className="p-4 border border-gray-300 rounded-md bg-white">
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="flex items-center space-x-2 px-3 py-1 border rounded-md bg-gray-100 hover:bg-gray-200"
      >
        <PlusCircle className="w-5 h-5" />
        <span>Toggle Drawer</span>
      </button>

      {/* Drawer */}
      {isDrawerOpen && (
        <div className="mt-3 flex space-x-2">
          <button
            onClick={() => handleActionClick("VOICE")}
            className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          >
            🎤 Voice
          </button>
          <button
            onClick={() => handleActionClick("IMAGE")}
            className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          >
            🖼 Image
          </button>
          <button
            onClick={() => handleActionClick("FILE")}
            className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          >
            📎 File
          </button>
        </div>
      )}

      {/* Debug Panel (development only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 p-2 border-t border-gray-200 bg-gray-50 text-xs font-mono max-h-40 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <strong>Debug Messages:</strong>
            <button
              onClick={clearMessages}
              className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
            >
              Clear Messages
            </button>
          </div>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(messages, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AtlasDrawerInterface;