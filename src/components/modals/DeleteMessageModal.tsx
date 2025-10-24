import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
  messageAge: number; // in minutes
  isDeletingForEveryone: boolean;
}

/**
 * Delete message modal with 2 options (WhatsApp/Telegram pattern):
 * 1. Delete for me (always available)
 * 2. Delete for everyone (only if within 48 hours)
 */
export function DeleteMessageModal({
  isOpen,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  messageAge,
  isDeletingForEveryone,
}: DeleteMessageModalProps) {
  
  // Can delete for everyone if within 48 hours (2880 minutes)
  const canDeleteForEveryone = messageAge <= 2880 && onDeleteForEveryone;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Delete Message</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-gray-300 text-sm">
              Choose who can see this message:
            </p>

            {/* Delete for Me */}
            <button
              onClick={() => {
                onDeleteForMe();
                onClose();
              }}
              disabled={isDeletingForEveryone}
              className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 transition-all hover:border-gray-600 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-semibold text-white mb-1">Delete for me</div>
              <div className="text-xs text-gray-400">
                This message will only be deleted for you. Others will still see it.
              </div>
            </button>

            {/* Delete for Everyone */}
            {canDeleteForEveryone ? (
              <button
                onClick={() => {
                  if (onDeleteForEveryone) {
                    onDeleteForEveryone();
                    onClose();
                  }
                }}
                disabled={isDeletingForEveryone}
                className="w-full p-4 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-400/30 transition-all hover:border-red-400/50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-semibold text-red-400 mb-1">Delete for everyone</div>
                <div className="text-xs text-gray-400">
                  This message will be deleted for all participants in the conversation.
                </div>
              </button>
            ) : (
              <div className="w-full p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 text-left opacity-60 cursor-not-allowed">
                <div className="font-semibold text-gray-500 mb-1">Delete for everyone</div>
                <div className="text-xs text-gray-500">
                  You can only delete for everyone within 48 hours of sending.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-750 text-white rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

