import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Edit3, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import type { Message } from '../../types/chat';

interface MessageContextMenuProps {
  message: Message; // Used for future edit functionality
  position: { x: number; y: number };
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

/**
 * Context menu that appears on right-click/long-press of a message
 * Industry-standard pattern from WhatsApp/Telegram
 */
export function MessageContextMenu({
  // message, // Reserved for future edit functionality
  position,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  canEdit = false,
  canDelete = false,
}: MessageContextMenuProps) {
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      onClose();
    };
    
    // Small delay to prevent immediate close from the same click that opened it
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const menuItems = [
    ...(canEdit && onEdit ? [{
      icon: Edit3,
      label: 'Edit',
      onClick: onEdit,
      className: 'text-[#8FA67E] hover:bg-[#8FA67E]/10',
    }] : []),
    ...(onCopy ? [{
      icon: Copy,
      label: 'Copy',
      onClick: onCopy,
      className: 'text-[#5A524A] hover:bg-[#E8DDD2]',
    }] : []),
    ...(canDelete && onDelete ? [{
      icon: Trash2,
      label: 'Delete',
      onClick: onDelete,
      className: 'text-[#A67571] hover:bg-[#CF9A96]/10',
    }] : []),
  ];

  // Don't render if no actions available
  if (menuItems.length === 0) {
    return null;
  }

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200), // Menu width ~180px
    y: Math.min(position.y, window.innerHeight - (menuItems.length * 44 + 16)), // Item height ~44px
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[100] bg-[#F9F6F3] backdrop-blur-xl rounded-xl shadow-2xl border border-[#E8DDD2] overflow-hidden"
        style={{
          left: `${adjustedPosition.x}px`,
          top: `${adjustedPosition.y}px`,
          minWidth: '180px',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click
      >
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              onClose();
            }}
            className={`
              w-full flex items-center gap-3 px-4 py-3
              transition-colors duration-150
              ${item.className}
              ${index > 0 ? 'border-t border-[#E8DDD2]/50' : ''}
            `}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

