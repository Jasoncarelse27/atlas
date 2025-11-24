/**
 * User Questionnaire Component
 * Collects user preferences for personalization
 * Follows Atlas modal patterns (AnimatePresence, backdrop blur, body scroll lock)
 */

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import type { QuestionnaireData } from '../../types/questionnaire';

interface UserQuestionnaireProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const WORK_FUNCTIONS = [
  'Student',
  'Entrepreneur',
  'Professional',
  'Creative',
  'Caregiver',
  'Other'
];

const GOAL_OPTIONS = [
  'Manage stress & overwhelm',
  'Stay focused & productive',
  'Improve relationships',
  'Build emotional awareness',
  'Track mood & patterns'
];

export function UserQuestionnaire({ isOpen, onClose, userId }: UserQuestionnaireProps) {
  const [workFunction, setWorkFunction] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [communicationStyle, setCommunicationStyle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Body scroll lock (follows Atlas modal pattern)
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev =>
      prev.includes(goal)
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    );
  };

  const handleSubmit = async () => {
    // 🚫 Guard: skip save if no user
    if (!userId) {
      logger.info("[UserQuestionnaire] Skipping save — no user session");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const preferences = {
        workFunction: workFunction || null,
        goals: selectedGoals.length > 0 ? selectedGoals : null,
        communicationStyle: communicationStyle.trim() || null
      };

      const { error } = await supabase
        .from('profiles')
        .update({ preferences })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      logger.info('[UserQuestionnaire] Preferences saved successfully');
      toast.success('Preferences saved! Atlas will personalize your experience.');
      onClose();
    } catch (error) {
      logger.error('[UserQuestionnaire] Failed to save preferences:', error);
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    logger.info('[UserQuestionnaire] Questionnaire skipped');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001]"
            onClick={handleSkip}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md max-h-[90vh] bg-[#F9F6F3] dark:bg-gray-900 rounded-2xl shadow-2xl border border-[#E8DDD2] dark:border-gray-700 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-[#E8DDD2] dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-[#3B3632] dark:text-white mb-1">
                      Help Atlas Know You Better
                    </h2>
                    <p className="text-sm text-[#8B7E74] dark:text-gray-400">
                      Optional - helps personalize your experience
                    </p>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close questionnaire"
                  >
                    <X className="w-5 h-5 text-[#8B7E74] dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Work Function */}
                <div>
                  <label className="block text-sm font-medium text-[#3B3632] dark:text-white mb-2">
                    What best describes your work?
                  </label>
                  <select
                    value={workFunction}
                    onChange={(e) => setWorkFunction(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[#E8DDD2] dark:border-gray-700 bg-white dark:bg-gray-800 text-[#3B3632] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] dark:focus:ring-gray-500"
                  >
                    <option value="">Select your work function</option>
                    {WORK_FUNCTIONS.map(func => (
                      <option key={func} value={func}>{func}</option>
                    ))}
                  </select>
                </div>

                {/* Goals */}
                <div>
                  <label className="block text-sm font-medium text-[#3B3632] dark:text-white mb-2">
                    What are your goals? (Select all that apply)
                  </label>
                  <div className="space-y-2">
                    {GOAL_OPTIONS.map(goal => (
                      <label
                        key={goal}
                        className="flex items-center gap-3 p-3 rounded-lg border border-[#E8DDD2] dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-[#F9F6F3] dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGoals.includes(goal)}
                          onChange={() => toggleGoal(goal)}
                          className="w-4 h-4 text-[#B2BDA3] dark:text-gray-500 rounded focus:ring-2 focus:ring-[#B2BDA3] dark:focus:ring-gray-500"
                        />
                        <span className="text-sm text-[#3B3632] dark:text-white">{goal}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Communication Style */}
                <div>
                  <label className="block text-sm font-medium text-[#3B3632] dark:text-white mb-2">
                    How should Atlas communicate with you?
                  </label>
                  <textarea
                    value={communicationStyle}
                    onChange={(e) => setCommunicationStyle(e.target.value)}
                    placeholder="e.g., ask clarifying questions before giving detailed answers"
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-[#E8DDD2] dark:border-gray-700 bg-white dark:bg-gray-800 text-[#3B3632] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] dark:focus:ring-gray-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#E8DDD2] dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-3">
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-sm text-[#8B7E74] dark:text-gray-400 hover:text-[#3B3632] dark:hover:text-white transition-colors"
                  disabled={isSubmitting}
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#B2BDA3] dark:bg-gray-700 hover:bg-[#8FA67E] dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

