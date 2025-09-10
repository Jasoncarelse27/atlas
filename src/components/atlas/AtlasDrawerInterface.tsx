import { PlusCircle, Mic, Image, Paperclip } from "lucide-react";
import React, { useState } from "react";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
    console.log("Drawer state toggled:", !isDrawerOpen ? "OPEN" : "CLOSED");
  };

  const handleActionClick = (type: string) => {
    console.log(`${type} button clicked ✅`);
  };

  return (
    <div className="p-4 border border-gray-300 rounded-md bg-white">
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
      >
        <PlusCircle size={18} />
        Toggle Drawer
      </button>

      {/* Drawer Content */}
      {isDrawerOpen && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => handleActionClick("Voice")}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Mic size={16} /> Voice
          </button>
          <button
            onClick={() => handleActionClick("Image")}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Image size={16} /> Image
          </button>
          <button
            onClick={() => handleActionClick("File")}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Paperclip size={16} /> File
          </button>
        </div>
      )}
    </div>
  );
};

export default AtlasDrawerInterface;