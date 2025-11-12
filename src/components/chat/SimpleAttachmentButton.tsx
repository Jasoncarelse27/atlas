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
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center"
        style={{ 
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 2147483647,
          pointerEvents: 'auto',
          touchAction: 'manipulation',
        }}
        aria-label="Upload image"
      >
        <Plus size={24} />
      </button>
    </>
  );
}
