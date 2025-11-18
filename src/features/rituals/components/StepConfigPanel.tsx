/**
 * Step Config Panel - Edit Ritual Step Properties
 * Allows users to customize duration and instructions for each step
 * 
 * ✅ BEST PRACTICE: Real-time validation with visual feedback
 */

import { AlertCircle, Clock, FileText, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import type { RitualStep } from '../types/rituals';
import { STEP_TYPE_DEFINITIONS } from './StepLibrary';

interface StepConfigPanelProps {
  step: RitualStep;
  onUpdate: (step: RitualStep) => void;
  onClose: () => void;
}

interface ValidationErrors {
  title?: string;
  instructions?: string;
}

export const StepConfigPanel: React.FC<StepConfigPanelProps> = ({ step, onUpdate, onClose }) => {
  const stepDef = STEP_TYPE_DEFINITIONS[step.type];
  const Icon = stepDef.icon;
  const [errors, setErrors] = useState<ValidationErrors>({});

  // ✅ BEST PRACTICE: Real-time validation
  useEffect(() => {
    const newErrors: ValidationErrors = {};
    
    // Validate title
    if (!step.config.title.trim()) {
      newErrors.title = 'Step title is required';
    } else if (step.config.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }
    
    // Validate instructions (optional but if provided, check length)
    if (step.config.instructions && step.config.instructions.length > 500) {
      newErrors.instructions = 'Instructions must be 500 characters or less';
    }
    
    setErrors(newErrors);
  }, [step.config.title, step.config.instructions]);

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
        <label 
          htmlFor="step-title-input"
          className="block text-sm font-medium text-[#3B3632] mb-2"
        >
          <FileText size={16} className="inline mr-2" />
          Step Title
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        </label>
        <input
          id="step-title-input"
          type="text"
          value={step.config.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={stepDef.label}
          maxLength={100}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
            ${errors.title 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 focus:ring-[#B2BDA3] focus:border-transparent'
            }`}
        />
        {errors.title && (
          <div 
            id="title-error"
            role="alert"
            className="mt-1 flex items-center gap-1 text-sm text-red-600"
          >
            <AlertCircle size={14} />
            <span>{errors.title}</span>
          </div>
        )}
        <div className="mt-1 text-xs text-gray-500 text-right">
          {step.config.title.length}/100
        </div>
      </div>

      {/* Duration */}
      <div className="mb-6">
        <label 
          htmlFor="step-duration-input"
          className="block text-sm font-medium text-[#3B3632] mb-2"
        >
          <Clock size={16} className="inline mr-2" />
          Duration: {step.duration} min
        </label>
        <input
          id="step-duration-input"
          type="range"
          min={stepDef.minDuration}
          max={stepDef.maxDuration}
          value={step.duration}
          onChange={(e) => handleDurationChange(Number(e.target.value))}
          aria-valuemin={stepDef.minDuration}
          aria-valuemax={stepDef.maxDuration}
          aria-valuenow={step.duration}
          aria-label={`Duration: ${step.duration} minutes`}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#B2BDA3]"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{stepDef.minDuration} min</span>
          <span aria-live="polite" aria-atomic="true">
            {step.duration} min
          </span>
          <span>{stepDef.maxDuration} min</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-6">
        <label 
          htmlFor="step-instructions-input"
          className="block text-sm font-medium text-[#3B3632] mb-2"
        >
          Instructions
          <span className="text-gray-400 text-xs ml-2">(Optional)</span>
        </label>
        <textarea
          id="step-instructions-input"
          value={step.config.instructions}
          onChange={(e) => handleInstructionsChange(e.target.value)}
          placeholder={stepDef.defaultInstructions}
          rows={4}
          maxLength={500}
          aria-invalid={!!errors.instructions}
          aria-describedby={errors.instructions ? 'instructions-error' : 'instructions-help'}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors resize-none
            ${errors.instructions 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 focus:ring-[#B2BDA3] focus:border-transparent'
            }`}
        />
        {errors.instructions && (
          <div 
            id="instructions-error"
            role="alert"
            className="mt-1 flex items-center gap-1 text-sm text-red-600"
          >
            <AlertCircle size={14} />
            <span>{errors.instructions}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span id="instructions-help">
            Add custom instructions for this step (optional)
          </span>
          <span>
            {step.config.instructions?.length || 0}/500
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">{stepDef.description}</p>
      </div>
    </div>
  );
};

