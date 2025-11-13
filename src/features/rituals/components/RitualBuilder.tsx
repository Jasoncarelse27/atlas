/**
 * Ritual Builder - Custom Ritual Creation
 * Drag-and-drop interface for Core/Studio users
 * 
 * Mobile Features:
 * - 48px drag handles with touch sensors
 * - Haptic feedback on drag/delete
 * - Bottom sheet for step config
 * - Responsive layout with mobile-first design
 */

import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Copy, GripVertical, Info, Plus, Save, Sparkles, TrendingUp, Trash2, X } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useRitualBuilder } from '../hooks/useRitualBuilder';
import { getQuickStartTemplate } from '../services/ritualSuggestions';
import type { RitualGoal, RitualStep } from '../types/rituals';
import { StepConfigPanel } from './StepConfigPanel';
import { STEP_TYPE_DEFINITIONS, StepLibrary } from './StepLibrary';

interface SortableStepCardProps {
  step: RitualStep;
  index: number;
  totalSteps: number;
  onEdit: (step: RitualStep) => void;
  onDelete: (stepId: string) => void;
  onDuplicate?: (stepId: string) => void;
  onKeyboardReorder?: (stepId: string, direction: 'up' | 'down') => void;
  triggerHaptic: (duration: number) => void;
  isMobile: boolean;
}

const SortableStepCard: React.FC<SortableStepCardProps> = React.memo(({ 
  step, 
  index,
  totalSteps,
  onEdit, 
  onDelete,
  onDuplicate,
  onKeyboardReorder,
  triggerHaptic,
  isMobile 
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stepDef = STEP_TYPE_DEFINITIONS[step.type];
  const Icon = stepDef.icon;

  const handleDelete = () => {
    triggerHaptic(100); // Strong haptic for delete
    onDelete(step.id);
  };

  const handleEdit = () => {
    triggerHaptic(10); // Light haptic for edit
    onEdit(step);
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white rounded-lg border-2 ${stepDef.color} 
          transition-all hover:shadow-md
          ${isMobile ? 'min-h-[60px]' : ''}`}
      >
        {/* Drag Handle - 48px minimum touch target */}
        <button
          {...attributes}
          {...listeners}
          onKeyDown={(e) => {
            // ✅ KEYBOARD NAVIGATION: Arrow keys to reorder steps
            if (e.key === 'ArrowUp' && index > 0 && onKeyboardReorder) {
              e.preventDefault();
              onKeyboardReorder(step.id, 'up');
            } else if (e.key === 'ArrowDown' && index < totalSteps - 1 && onKeyboardReorder) {
              e.preventDefault();
              onKeyboardReorder(step.id, 'down');
            }
          }}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 
            flex-shrink-0 touch-target
            active:scale-110 transition-transform
            focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:ring-offset-1"
          aria-label={`Step ${index + 1}: ${step.config.title}. Press arrow keys to reorder.`}
          tabIndex={0}
        >
          <GripVertical size={isMobile ? 24 : 20} />
        </button>

        {/* Step Number */}
        <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-200 
          flex items-center justify-center text-xs font-semibold text-gray-600">
          {index + 1}
        </div>

        {/* Icon */}
        <div className={`p-2 rounded-lg ${stepDef.color} flex-shrink-0`}>
          <Icon size={isMobile ? 20 : 18} />
        </div>

        {/* Info - Tappable to edit */}
        <div 
          className="flex-1 min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:ring-offset-1 rounded" 
          onClick={handleEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEdit();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Edit ${step.config.title}`}
        >
          <div className="font-medium text-sm sm:text-base text-[#3B3632] line-clamp-2">
            {step.config.title}
          </div>
          <div className="text-xs text-gray-600">{step.duration} min</div>
        </div>

        {/* Action Buttons - Always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1">
          {/* Duplicate Button */}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(step.id)}
              className={`flex-shrink-0 p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors
                min-h-[44px] min-w-[44px]
                ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="Duplicate step"
              title="Duplicate step"
            >
              <Copy size={isMobile ? 20 : 18} />
            </button>
          )}
          
          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className={`flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors
              min-h-[44px] min-w-[44px]
              ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            aria-label="Delete step"
            title="Delete step"
          >
            <Trash2 size={isMobile ? 20 : 18} />
          </button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if step data or index changes
  return (
    prevProps.step.id === nextProps.step.id &&
    prevProps.step.duration === nextProps.step.duration &&
    prevProps.step.config.title === nextProps.step.config.title &&
    prevProps.step.config.instructions === nextProps.step.config.instructions &&
    prevProps.index === nextProps.index &&
    prevProps.totalSteps === nextProps.totalSteps &&
    prevProps.isMobile === nextProps.isMobile
  );
});

export const RitualBuilder: React.FC = () => {
  const {
    // State
    title,
    setTitle,
    goal,
    setGoal,
    steps,
    setSteps,
    selectedStep,
    setSelectedStep,
    saving,
    isInitializing,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    showMobileConfig,
    setShowMobileConfig,
    totalDuration,
    isEditing,

    // Actions
    handleAddStep,
    handleDeleteStep,
    handleDuplicateStep,
    handleUpdateStep,
    handleEditStep,
    handleKeyboardReorder,
    handleDragStart,
    handleDragEnd,
    handleSave,

    // Navigation
    navigate,
    
    // Context
    tier,
    showGenericUpgrade,
    isMobile,
    triggerHaptic,
  } = useRitualBuilder();

  // Touch sensors for mobile drag-and-drop
  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250, // 250ms delay for scrolling
      tolerance: 5, // 5px movement tolerance
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Tier gate
  if (tier === 'free') {
    return (
      <div className="min-h-screen bg-[#F9F6F1] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-[#E8DCC8] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#3B3632] mb-2">Unlock Custom Rituals</h2>
          <p className="text-gray-600 mb-6">
            Upgrade to <strong>Core</strong> to create personalized rituals tailored to your needs.
          </p>
          <button
            onClick={() => showGenericUpgrade('audio')}
            className="w-full px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] transition-colors font-medium"
          >
            Upgrade to Core ($19.99)
          </button>
          <button
            onClick={() => navigate('/rituals')}
            className="mt-3 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Back to Ritual Library
          </button>
        </div>
      </div>
    );
  }

  // ✅ PHASE 3: Skeleton loader for initial load
  if (isInitializing) {
    return (
      <div className="h-screen overflow-y-auto bg-[#F9F6F1] overscroll-contain">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-8 bg-gray-200 rounded w-64 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-48" />
              </div>
              <div className="w-32 h-12 bg-gray-200 rounded-xl" />
            </div>
            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-32" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg" />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-xl p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-40" />
                  <div className="h-12 bg-gray-200 rounded-lg" />
                  <div className="h-12 bg-gray-200 rounded-lg" />
                  <div className="h-20 bg-gray-200 rounded-lg" />
                </div>
                <div className="bg-white rounded-xl p-6">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded-lg mb-3" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#F9F6F1] overscroll-contain">
      {/* ✅ PHASE 3: ARIA Live Region for dynamic announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {suggestions.length > 0 && `${suggestions.length} suggestions available`}
        {steps.length > 0 && `Ritual has ${steps.length} step${steps.length !== 1 ? 's' : ''}`}
        {saving && 'Saving ritual...'}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                triggerHaptic(10);
                navigate('/rituals');
              }}
              className="p-2 hover:bg-white rounded-lg transition-colors
                min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Back to ritual library"
            >
              <ArrowLeft size={isMobile ? 24 : 20} className="text-[#3B3632]" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#3B3632]">
                {isEditing ? 'Edit Ritual' : 'Create Custom Ritual'}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {isEditing ? 'Update your personalized micro-moment' : 'Design your personalized micro-moment'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* ✅ Insights Button - Show for Core/Studio tiers */}
            {tier !== 'free' && (
              <button
                onClick={() => {
                  triggerHaptic(10);
                  navigate('/rituals/insights');
                }}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E8DCC8] text-[#3B3632] 
                  rounded-xl hover:bg-[#F9F6F1] transition-all hover:shadow-md active:scale-95
                  min-h-[44px] touch-manipulation"
                aria-label="View ritual insights"
              >
                <TrendingUp size={18} />
                <span className="font-medium">Insights</span>
              </button>
            )}
            
            <button
              onClick={() => {
                triggerHaptic(50);
                handleSave();
              }}
              disabled={saving || steps.length === 0 || !title.trim()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 
                bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] 
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium
                min-h-[48px] touch-manipulation active:scale-95"
            >
              <Save size={20} />
              <span>{saving ? 'Saving...' : 'Save Ritual'}</span>
            </button>
          </div>
        </div>

        {/* Mobile: Stack vertically, Desktop: 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Step Library - More accessible on mobile */}
          <div className={`lg:col-span-1 ${isMobile ? 'order-2' : ''}`}>
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-4 sm:p-6 lg:sticky lg:top-4 safe-bottom-nav">
              <StepLibrary onStepSelect={handleAddStep} />
            </div>
          </div>

          {/* Ritual Canvas - Centered on desktop, top on mobile */}
          <div className={`lg:col-span-1 space-y-4 sm:space-y-6 ${isMobile ? 'order-1' : ''}`}>
            {/* Ritual Info */}
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-4 sm:p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#3B3632] mb-2">
                  Ritual Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Morning Energy Boost"
                  className="w-full px-4 py-2 sm:py-3 border border-gray-300 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent
                    text-base min-h-[48px]"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#3B3632] mb-2">Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as RitualGoal)}
                  className="w-full px-4 py-2 sm:py-3 border border-gray-300 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent
                    text-base min-h-[48px]"
                >
                  <option value="energy">Energy</option>
                  <option value="calm">Calm</option>
                  <option value="focus">Focus</option>
                  <option value="creativity">Creativity</option>
                </select>
              </div>

              {/* ✅ PHASE 2: Quick Templates */}
              {steps.length === 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-2">Quick Start Templates:</p>
                  <div className="flex flex-wrap gap-2">
                    {(['5', '10'] as const).map((time) => (
                      <button
                        key={time}
                        onClick={() => {
                          const template = getQuickStartTemplate(goal, parseInt(time));
                          setTitle(template.title);
                          // Template returns durations in seconds, convert to minutes for UI
                          setSteps(template.steps.map((s, i) => ({
                            ...s,
                            id: uuidv4(),
                            order: i,
                            duration: s.duration / 60, // Convert seconds to minutes
                          })) as RitualStep[]);
                          triggerHaptic(50);
                          toast.success(`Loaded ${template.title} template`, {
                            description: `${template.steps.length} steps added`,
                            duration: 3000,
                          });
                        }}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors active:scale-95 touch-manipulation"
                      >
                        {time} min {goal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Duration</span>
                <span 
                  className="text-lg font-bold text-[#3B3632]"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {totalDuration} min
                </span>
              </div>
            </div>

            {/* Smart Suggestions */}
            {suggestions.length > 0 && showSuggestions && (
              <div 
                className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4 sm:p-5 mb-4 sm:mb-6"
                role="status"
                aria-live="polite"
                aria-atomic="false"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2 text-sm sm:text-base">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                    Suggestions
                  </h4>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                    aria-label="Hide suggestions"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className={`text-sm sm:text-base ${
                        suggestion.severity === 'warning'
                          ? 'text-orange-800'
                          : suggestion.severity === 'suggestion'
                          ? 'text-blue-800'
                          : 'text-blue-700'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">
                          {suggestion.severity === 'warning' ? '⚠️' : '💡'}
                        </span>
                        <div className="flex-1">
                          <p>{suggestion.message}</p>
                          {suggestion.action && (
                            <button
                              onClick={() => {
                                if (suggestion.action?.stepType) {
                                  handleAddStep(suggestion.action.stepType);
                                  triggerHaptic(50);
                                }
                              }}
                              className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition-colors active:scale-95 touch-manipulation min-h-[36px]"
                            >
                              {suggestion.action.label}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-4 sm:p-6">
              <h3 
                className="text-sm font-semibold text-[#3B3632] uppercase tracking-wide mb-4"
                aria-live="polite"
                aria-atomic="true"
              >
                Your Ritual ({steps.length} step{steps.length !== 1 ? 's' : ''})
              </h3>

              {steps.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <Plus size={48} className="text-gray-300 mx-auto mb-4" />
                  <div>
                    <p className="text-gray-600 font-medium mb-2">
                      Start Building Your Ritual
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      Choose steps from the library to create your personalized ritual
                    </p>
                  </div>
                  
                  {/* First-time hint */}
                  {isMobile && (
                    <div className="bg-blue-50 p-3 rounded-lg mx-auto max-w-xs">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-left">
                          <p className="text-xs text-blue-800 font-medium">Pro tip:</p>
                          <p className="text-xs text-blue-700">
                            Drag steps to reorder them. Tap any step to customize duration and instructions.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <DndContext 
                  collisionDetection={closestCenter} 
                  onDragEnd={handleDragEnd}
                  onDragStart={handleDragStart}
                  sensors={sensors}
                >
                  <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {steps.map((step, index) => (
                        <SortableStepCard
                          key={step.id}
                          step={step}
                          index={index}
                          totalSteps={steps.length}
                          onEdit={handleEditStep}
                          onDelete={handleDeleteStep}
                          onDuplicate={handleDuplicateStep}
                          onKeyboardReorder={handleKeyboardReorder}
                          triggerHaptic={triggerHaptic}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Config Panel - Desktop only, mobile uses bottom sheet */}
          {!isMobile && (
            <div className="lg:col-span-1">
              <div className="sticky top-4">
                {selectedStep ? (
                  <StepConfigPanel
                    step={selectedStep}
                    onUpdate={handleUpdateStep}
                    onClose={() => setSelectedStep(null)}
                  />
                ) : (
                  <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6 text-center">
                    <p className="text-gray-500 text-sm">
                      Click on a step to edit its duration and instructions
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button - Mobile Only */}
      {isMobile && (
        <button
          onClick={() => navigate('/rituals/library')}
          className="fixed bottom-20 right-4 w-14 h-14 bg-atlas-orange 
            rounded-full shadow-lg flex items-center justify-center z-40
            active:scale-95 transition-transform"
          aria-label="Browse ritual library"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Mobile Bottom Sheet for Step Config */}
      {isMobile && showMobileConfig && selectedStep && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-200"
            onClick={() => {
              triggerHaptic(10);
              setShowMobileConfig(false);
            }}
          />
          
          {/* Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl 
            animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                triggerHaptic(10);
                setShowMobileConfig(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 active:scale-95 
                min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X size={24} className="text-gray-600" />
            </button>

            {/* Config Panel Content */}
            <div className="px-4 pb-8 pt-4">
              <StepConfigPanel
                step={selectedStep}
                onUpdate={(updated) => {
                  handleUpdateStep(updated);
                  triggerHaptic(50);
                }}
                onClose={() => {
                  triggerHaptic(10);
                  setShowMobileConfig(false);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

