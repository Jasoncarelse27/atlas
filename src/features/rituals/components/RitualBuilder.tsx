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

import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useTierQuery } from '@/hooks/useTierQuery';
import { logger } from '@/lib/logger';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useRitualStore } from '../hooks/useRitualStore';
import type { Ritual, RitualGoal, RitualStep, RitualStepType } from '../types/rituals';
import { StepConfigPanel } from './StepConfigPanel';
import { STEP_TYPE_DEFINITIONS, StepLibrary } from './StepLibrary';

interface SortableStepCardProps {
  step: RitualStep;
  index: number;
  onEdit: (step: RitualStep) => void;
  onDelete: (stepId: string) => void;
  triggerHaptic: (duration: number) => void;
  isMobile: boolean;
}

const SortableStepCard: React.FC<SortableStepCardProps> = ({ 
  step, 
  index, 
  onEdit, 
  onDelete,
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
        {/* Drag Handle - 48px minimum touch target on mobile */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 
            flex-shrink-0 p-2 sm:p-1
            min-h-[48px] min-w-[48px] sm:min-h-0 sm:min-w-0
            flex items-center justify-center
            active:scale-110 transition-transform"
          aria-label="Drag to reorder"
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
          className="flex-1 min-w-0 cursor-pointer" 
          onClick={handleEdit}
        >
          <div className="font-medium text-sm sm:text-base text-[#3B3632] truncate">
            {step.config.title}
          </div>
          <div className="text-xs text-gray-600">{step.duration} min</div>
        </div>

        {/* Delete Button - Always visible on mobile, hover on desktop */}
        <button
          onClick={handleDelete}
          className={`flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors
            min-h-[44px] min-w-[44px]
            ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          aria-label="Delete step"
        >
          <Trash2 size={isMobile ? 20 : 18} />
        </button>
      </div>
    </div>
  );
};

export const RitualBuilder: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tier, userId } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const { createRitual } = useRitualStore();
  const { isMobile, triggerHaptic } = useMobileOptimization();

  // Touch sensors for mobile drag-and-drop
  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250, // 250ms delay for scrolling
      tolerance: 5, // 5px movement tolerance
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Check if we're editing an existing ritual
  const editRitual = location.state?.editRitual as Ritual | undefined;
  const isEditing = !!editRitual;

  // Initialize state from editRitual if editing
  const [title, setTitle] = useState(editRitual?.title || '');
  const [goal, setGoal] = useState<RitualGoal>(editRitual?.goal || 'focus');
  const [steps, setSteps] = useState<RitualStep[]>(() => {
    if (editRitual?.steps) {
      // Check if durations are already in minutes (< 10) or in seconds (> 10)
      // This handles both old corrupted data and new data
      return editRitual.steps.map(step => ({
        ...step,
        duration: step.duration < 10 
          ? step.duration // Already corrupted/in minutes, keep as is
          : step.duration / 60, // In seconds, convert to minutes
      }));
    }
    return [];
  });
  const [selectedStep, setSelectedStep] = useState<RitualStep | null>(null);
  const [saving, setSaving] = useState(false);

  // Mobile: Show config as bottom sheet
  const [showMobileConfig, setShowMobileConfig] = useState(false);

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

  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  const handleAddStep = (stepType: RitualStepType) => {
    const stepDef = STEP_TYPE_DEFINITIONS[stepType];
    const newStep: RitualStep = {
      id: uuidv4(),
      type: stepType,
      duration: stepDef.defaultDuration,
      order: steps.length,
      config: {
        title: stepDef.label,
        instructions: stepDef.defaultInstructions,
      },
    };

    setSteps([...steps, newStep]);
    triggerHaptic(50); // Medium haptic for add
    toast.success(`Added ${stepDef.label}`);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
    if (selectedStep?.id === stepId) {
      setSelectedStep(null);
      if (isMobile) setShowMobileConfig(false);
    }
    toast.success('Step removed');
  };

  const handleUpdateStep = (updatedStep: RitualStep) => {
    setSteps(steps.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
  };

  const handleEditStep = (step: RitualStep) => {
    setSelectedStep(step);
    if (isMobile) {
      setShowMobileConfig(true);
    }
  };

  const handleDragStart = (_event: DragStartEvent) => {
    triggerHaptic(10); // Light haptic on drag start
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => s.id === active.id);
      const newIndex = steps.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(steps, oldIndex, newIndex).map((step, index) => ({
        ...step,
        order: index,
      }));

      setSteps(reordered);
      triggerHaptic(50); // Medium haptic on reorder
    } else {
      triggerHaptic(10); // Light haptic on cancel
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      toast.error('Please enter a ritual title');
      return;
    }

    if (steps.length === 0) {
      toast.error('Add at least one step to your ritual');
      return;
    }

    if (!userId) {
      toast.error('You must be logged in to save rituals');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saving ritual...');

    try {
      // Convert step durations from MINUTES to SECONDS for consistency with presets
      const stepsWithCorrectDuration = steps.map(step => ({
        ...step,
        duration: step.duration * 60, // Convert minutes to seconds
      }));

      await createRitual({
        userId,
        title: title.trim(),
        goal,
        steps: stepsWithCorrectDuration,
        isPreset: false,
        tierRequired: tier,
      });

      toast.dismiss(loadingToast);
      toast.success('✨ Ritual saved successfully!');
      navigate('/rituals');
    } catch (error) {
      logger.error('[RitualBuilder] Failed to save ritual:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to save ritual. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F1]">
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

        {/* Mobile: Stack vertically, Desktop: 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Step Library - Hidden on mobile behind expand/collapse or in modal */}
          <div className={`lg:col-span-1 ${isMobile ? 'order-3' : ''}`}>
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-4 sm:p-6 lg:sticky lg:top-4">
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

              <div>
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

              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Duration</span>
                <span className="text-lg font-bold text-[#3B3632]">{totalDuration} min</span>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-[#3B3632] uppercase tracking-wide mb-4">
                Your Ritual ({steps.length} steps)
              </h3>

              {steps.length === 0 ? (
                <div className="text-center py-12">
                  <Plus size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">
                    Add steps from the library to build your ritual
                  </p>
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
                          onEdit={handleEditStep}
                          onDelete={handleDeleteStep}
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

