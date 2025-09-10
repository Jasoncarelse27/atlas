import { Image, Mic, Paperclip, PlusCircle } from "lucide-react";
import React, { useState } from "react";
import { useMessageStore } from "@/stores/useMessageStore";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const addMessage = useMessageStore((state) => state.addMessage);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
    console.log("Drawer state toggled:", !isDrawerOpen ? "OPEN" : "CLOSED");
  };

  const handleActionClick = (type: "VOICE" | "IMAGE" | "FILE") => {
    const newMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: `[${type}] ${type.toLowerCase()} message placeholder`,
      createdAt: new Date().toISOString(),
    };
    addMessage(newMessage);
    console.log(`${type} button clicked ✅`, newMessage);
    setIsDrawerOpen(false); // auto-close drawer
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

      {/* Drawer Content */}
      {isDrawerOpen && (
        <div className="mt-4 flex space-x-3">
          <button
            onClick={() => handleActionClick("VOICE")}
            className="flex items-center space-x-1 px-3 py-1 border rounded-md bg-gray-100 hover:bg-gray-200"
          >
            <Mic className="w-4 h-4" />
            <span>Voice</span>
          </button>
          <button
            onClick={() => handleActionClick("IMAGE")}
            className="flex items-center space-x-1 px-3 py-1 border rounded-md bg-gray-100 hover:bg-gray-200"
          >
            <Image className="w-4 h-4" />
            <span>Image</span>
          </button>
          <button
            onClick={() => handleActionClick("FILE")}
            className="flex items-center space-x-1 px-3 py-1 border rounded-md bg-gray-100 hover:bg-gray-200"
          >
            <Paperclip className="w-4 h-4" />
            <span>File</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AtlasDrawerInterface;