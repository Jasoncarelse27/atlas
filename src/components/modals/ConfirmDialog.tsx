// ✅ BEST PRACTICE: Reusable confirmation dialog component
// Mobile-friendly, accessible, and matches Atlas design system

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // ✅ BEST PRACTICE: Focus trap and keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = [cancelButtonRef.current, confirmButtonRef.current].filter(
        (el) => el !== null
      ) as HTMLButtonElement[];

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    // ✅ BEST PRACTICE: Focus first button on open
    setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 100);

    // ✅ BEST PRACTICE: Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDestructive = variant === 'destructive';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-md bg-atlas-pearl dark:bg-gray-900 rounded-2xl shadow-2xl border border-atlas-border dark:border-gray-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-atlas-border dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDestructive
                    ? 'bg-red-500/10'
                    : 'bg-atlas-sage/20'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 ${
                    isDestructive ? 'text-red-500' : 'text-atlas-sage'
                  }`}
                />
              </div>
              <h2
                id="confirm-dialog-title"
                className="text-xl font-bold text-atlas-text-dark dark:text-white"
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-atlas-button transition-colors"
              aria-label="Close dialog"
              disabled={isLoading}
            >
              <X className="w-5 h-5 text-atlas-text-medium dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p
              id="confirm-dialog-message"
              className="text-atlas-text-medium dark:text-gray-300 leading-relaxed"
            >
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-atlas-border dark:border-gray-700">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-atlas-button dark:bg-gray-700 hover:bg-atlas-button-hover dark:hover:bg-gray-600 text-atlas-text-dark dark:text-white rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-atlas-sage focus-visible:outline-none"
              aria-label={cancelLabel}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={async () => {
                await onConfirm();
              }}
              disabled={isLoading}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:outline-none ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500'
                  : 'bg-atlas-sage hover:bg-atlas-success text-white focus-visible:ring-atlas-sage'
              }`}
              aria-label={confirmLabel}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

