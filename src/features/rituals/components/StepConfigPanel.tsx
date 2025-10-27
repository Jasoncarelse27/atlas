/**
 * Step Config Panel - Edit Ritual Step Properties
 * Allows users to customize duration and instructions for each step
 */

import { Clock, FileText, X } from 'lucide-react';
import React from 'react';
import type { RitualStep } from '../types/rituals';
import { STEP_TYPE_DEFINITIONS } from './StepLibrary';

interface StepConfigPanelProps {
  step: RitualStep;
  onUpdate: (step: RitualStep) => void;
  onClose: () => void;
}

export const StepConfigPanel: React.FC<StepConfigPanelProps> = ({ step, onUpdate, onClose }) => {
  const stepDef = STEP_TYPE_DEFINITIONS[step.type];
  const Icon = stepDef.icon;

  const handleDurationChange = (duration: number) => {
    onUpdate({
      ...step,
      duration: Math.max(stepDef.minDuration, Math.min(stepDef.maxDuration, duration)),
    });
  };

  const handleInstructionsChange = (instructions: string) => {
    onUpdate({
      ...step,
      config: {
        ...step.config,
        instructions,
      },
    });
  };

  const handleTitleChange = (title: string) => {
    onUpdate({
      ...step,
      config: {
        ...step.config,
        title,
      },
    });
  };

  return (
    <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${stepDef.color}`}>
            <Icon size={20} />
          </div>
          <h3 className="text-lg font-semibold text-[#3B3632]">{stepDef.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close panel"
        >
          <X size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#3B3632] mb-2">
          <FileText size={16} className="inline mr-2" />
          Step Title
        </label>
        <input
          type="text"
          value={step.config.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={stepDef.label}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent"
        />
      </div>

      {/* Duration */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#3B3632] mb-2">
          <Clock size={16} className="inline mr-2" />
          Duration: {step.duration} min
        </label>
        <input
          type="range"
          min={stepDef.minDuration}
          max={stepDef.maxDuration}
          value={step.duration}
          onChange={(e) => handleDurationChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#B2BDA3]"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{stepDef.minDuration} min</span>
          <span>{stepDef.maxDuration} min</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#3B3632] mb-2">Instructions</label>
        <textarea
          value={step.config.instructions}
          onChange={(e) => handleInstructionsChange(e.target.value)}
          placeholder={stepDef.defaultInstructions}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent resize-none"
        />
      </div>

      {/* Info */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">{stepDef.description}</p>
      </div>
    </div>
  );
};

