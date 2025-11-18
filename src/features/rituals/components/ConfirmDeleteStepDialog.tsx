/**
 * Confirm Delete Step Dialog
 * Reusable confirmation dialog for deleting ritual steps
 * Matches DeleteMessageModal pattern with glassmorphism design
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import type { RitualStep } from '../types/rituals';
import { STEP_TYPE_DEFINITIONS } from './StepLibrary';

interface ConfirmDeleteStepDialogProps {
  isOpen: boolean;
  step: RitualStep | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteStepDialog({
  isOpen,
  step,
  onClose,
  onConfirm,
}: ConfirmDeleteStepDialogProps) {
  if (!isOpen || !step) return null;

  const stepDef = STEP_TYPE_DEFINITIONS[step.type];
  const Icon = stepDef.icon;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

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
          className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Step</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              Are you sure you want to delete this step? This action cannot be undone.
            </p>

            {/* Step Preview */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stepDef.color}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {step.config.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {stepDef.label} • {step.duration} min
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Delete Step
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

