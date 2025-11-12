import React, { useRef } from 'react';
import { Plus } from 'lucide-react';

export function SimpleAttachmentButton({ onImageSelect }: { onImageSelect: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImageSelect(file);
            // Clear input so same file can be selected again
            e.target.value = '';
          }
        }}
      />
      
      <button
        onClick={() => inputRef.current?.click()}
        className="h-[44px] w-[44px] p-2 rounded-full bg-atlas-peach hover:bg-atlas-sage text-gray-800 transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center flex-shrink-0"
        style={{ 
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 999999999,
        }}
      >
        <Plus size={20} />
      </button>
    </>
  );
}
