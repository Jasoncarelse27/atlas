/**
 * Ritual Preview Component
 * Shows ritual as it would appear in run view (without timer)
 */

import { ArrowLeft, Clock, Edit } from 'lucide-react';
import React from 'react';
import { STEP_TYPE_DEFINITIONS } from './StepLibrary';
import type { Ritual } from '../types/rituals';

interface RitualPreviewProps {
  ritual: {
    title: string;
    goal: string;
    steps: Ritual['steps'];
  };
  onEdit: () => void;
  onClose: () => void;
}

export function RitualPreview({ ritual, onEdit, onClose }: RitualPreviewProps) {
  const estimatedTime = ritual.steps.reduce((sum, step) => sum + step.duration, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-[#E8DCC8] dark:border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to builder"
            >
              <ArrowLeft size={20} className="text-[#3B3632] dark:text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#3B3632] dark:text-white">
                Preview: {ritual.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock size={14} />
                <span>Estimated time: {estimatedTime} minutes</span>
              </div>
            </div>
          </div>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] transition-colors active:scale-95"
          >
            <Edit size={18} />
            Edit Ritual
          </button>
        </div>
      </div>

      {/* Preview Content - Reuses RitualRunView layout style */}
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Goal Badge */}
        <div className="text-center">
          <span className="inline-block px-4 py-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full text-sm font-medium text-[#3B3632] dark:text-white border border-[#E8DCC8] dark:border-gray-700">
            {ritual.goal.charAt(0).toUpperCase() + ritual.goal.slice(1)} Ritual
          </span>
        </div>

        {/* Steps Preview */}
        <div className="space-y-4">
          {ritual.steps.map((step, index) => {
            const stepDef = STEP_TYPE_DEFINITIONS[step.type];
            const Icon = stepDef.icon;
            
            return (
              <div
                key={step.id}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-[#E8DCC8] dark:border-gray-700"
              >
                <div className="flex items-start gap-4">
                  {/* Step Number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-[#C8956A] to-[#B8855A] flex items-center justify-center text-white font-bold text-lg">
                    {index + 1}
                  </div>
                  
                  {/* Step Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${stepDef.color}`}>
                        <Icon size={20} />
                      </div>
                      <h3 className="text-lg font-semibold text-[#3B3632] dark:text-white">
                        {step.config.title}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {step.duration} {step.duration === 1 ? 'minute' : 'minutes'}
                      </span>
                    </div>
                    
                    {step.config.instructions && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                          {step.config.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border-2 border-[#E8DCC8] dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Steps</p>
              <p className="text-2xl font-bold text-[#3B3632] dark:text-white">{ritual.steps.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Duration</p>
              <p className="text-2xl font-bold text-[#3B3632] dark:text-white">{estimatedTime} min</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

