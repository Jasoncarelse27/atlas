import { PlusCircle } from "lucide-react";
import React, { useState } from "react";

const AtlasDrawerInterface: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  return (
    <div className="p-4 border border-gray-300 rounded-md">
      {/* Toggle Button */}
      <button
        onClick={toggleDrawer}
        className="flex items-center gap-2 px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
      >
        <PlusCircle size={20} />
        <span>Toggle Drawer</span>
      </button>

      {/* Debug Drawer Content */}
      {isDrawerOpen && (
        <div className="mt-4 p-3 border border-green-400 bg-green-50 rounded">
          Drawer Loaded ✅
        </div>
      )}
    </div>
  );
};

export default AtlasDrawerInterface;