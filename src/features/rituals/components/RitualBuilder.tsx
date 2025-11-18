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

import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, Eye, GripVertical, Info, Plus, Redo, Save, Sparkles, Trash2, TrendingUp, Undo, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useAndroidKeyboard } from '../../../hooks/useAndroidKeyboard';
import { getDisplayPrice } from '../../../config/pricing';
import { useRitualBuilder } from '../hooks/useRitualBuilder';
import { useRitualBuilderShortcuts } from '../hooks/useRitualBuilderShortcuts';
import { getQuickStartTemplate } from '../services/ritualSuggestions';
import type { RitualGoal, RitualStep } from '../types/rituals';
import { StepConfigPanel } from './StepConfigPanel';
import { STEP_TYPE_DEFINITIONS, StepLibrary } from './StepLibrary';
import { ConfirmDeleteStepDialog } from './ConfirmDeleteStepDialog';
import { RitualPreview } from './RitualPreview';

// ✅ PHASE 2: Mobile Bottom Sheet Component with Swipe-to-Dismiss
interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  keyboardHeight: number;
  children: React.ReactNode;
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({ isOpen, onClose, keyboardHeight, children }) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = React.useRef(0);
  const currentYRef = React.useRef(0);
  const SWIPE_THRESHOLD = 100; // pixels to swipe down to dismiss

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    currentYRef.current = e.touches[0].clientY;
    const deltaY = currentYRef.current - startYRef.current;
    // Only allow dragging down
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > SWIPE_THRESHOLD) {
      onClose();
    }
    setDragY(0);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: dragY > 0 ? `${dragY}px` : 0 }}
        exit={{ y: '100%' }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        }}
        className="fixed left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl 
          overflow-y-auto safe-bottom"
        style={{
          bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0',
          maxHeight: keyboardHeight > 0 ? `calc(85vh - ${keyboardHeight}px)` : '85vh',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ✅ PHASE 2: Enhanced Handle Bar */}
        <div 
          className="flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
        >
          <div className="w-16 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-4 pb-8 pt-2">
          {children}
        </div>
      </motion.div>
    </>
  );
};

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
    // ✅ PHASE 1: Show confirmation dialog instead of direct delete
    // This will be handled by parent component
    onDelete(step.id);
  };

  const handleEdit = () => {
    triggerHaptic(10); // Light haptic for edit
    onEdit(step);
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border-2 ${stepDef.color} 
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
            focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:ring-offset-1
            min-h-[48px] min-w-[48px] flex items-center justify-center p-2"
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
            onClick={() => {
              triggerHaptic(10);
              // ✅ PHASE 1: Trigger confirmation dialog
              if (onDelete) {
                // Pass step to parent for confirmation
                (onDelete as any)(step);
              }
            }}
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
    hasUnsavedChanges,
    draftSavedAt,
    restoreDraft,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,

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
    userId,
    showGenericUpgrade,
    isMobile,
    triggerHaptic,
  } = useRitualBuilder();

  // ✅ PHASE 1: Delete confirmation state
  const [stepToDelete, setStepToDelete] = useState<RitualStep | null>(null);
  
  // ✅ PHASE 1: Drag overlay state
  const [activeStep, setActiveStep] = useState<RitualStep | null>(null);
  
  // ✅ PHASE 3: Preview mode state
  const [previewMode, setPreviewMode] = useState(false);
  
  // ✅ PHASE 1: Draft restore prompt state
  const [showDraftRestorePrompt, setShowDraftRestorePrompt] = useState(false);
  const hasShownPromptRef = React.useRef(false);
  
  // ✅ PHASE 1: Show draft restore prompt on mount if draft exists (only once)
  React.useEffect(() => {
    if (draftSavedAt && !isEditing && !hasShownPromptRef.current) {
      hasShownPromptRef.current = true;
      setShowDraftRestorePrompt(true);
    }
  }, [draftSavedAt, isEditing]);

  // ✅ PHASE 1: Draft saved indicator state
  const [showDraftSavedIndicator, setShowDraftSavedIndicator] = useState(false);
  
  React.useEffect(() => {
    if (draftSavedAt) {
      setShowDraftSavedIndicator(true);
      const timer = setTimeout(() => setShowDraftSavedIndicator(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [draftSavedAt]);

  // ✅ PHASE 1: Android keyboard handling for bottom sheet
  const { isOpen: isKeyboardOpen, height: keyboardHeight } = useAndroidKeyboard();

  // ✅ PHASE 1: Handle delete with confirmation
  const handleDeleteWithConfirmation = (step: RitualStep) => {
    setStepToDelete(step);
  };

  const confirmDelete = () => {
    if (stepToDelete) {
      handleDeleteStep(stepToDelete.id);
      setStepToDelete(null);
    }
  };

  const cancelDelete = () => {
    setStepToDelete(null);
  };

  // ✅ PHASE 1: Enhanced drag handlers with overlay
  const handleDragStartWithOverlay = (event: DragStartEvent) => {
    handleDragStart(event);
    const step = steps.find(s => s.id === event.active.id);
    if (step) setActiveStep(step);
  };

  const handleDragEndWithOverlay = (event: DragEndEvent) => {
    handleDragEnd(event);
    setActiveStep(null);
  };

  // ✅ PHASE 2: Keyboard shortcuts integration
  useRitualBuilderShortcuts({
    onSave: handleSave,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onOpenLibrary: () => {
      const libraryElement = document.querySelector('[data-step-library]');
      if (libraryElement) {
        libraryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        triggerHaptic(10);
      }
    },
    onClosePanels: () => {
      if (showMobileConfig) {
        setShowMobileConfig(false);
        setSelectedStep(null);
      }
    },
    disabled: false,
    isMobile,
  });

  // Touch sensors for mobile drag-and-drop
  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250, // 250ms delay for scrolling
      tolerance: 5, // 5px movement tolerance
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // ✅ PHASE 3: Show preview mode if enabled
  if (previewMode && steps.length > 0) {
    return (
      <RitualPreview
        ritual={{
          title: title || 'Untitled Ritual',
          goal,
          steps,
        }}
        onEdit={() => setPreviewMode(false)}
        onClose={() => setPreviewMode(false)}
      />
    );
  }

  // Tier gate
  if (tier === 'free') {
    return (
      <div className="min-h-screen bg-[#F9F6F1] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border-2 border-[#E8DCC8] dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#3B3632] dark:text-white mb-2">Unlock Custom Rituals</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upgrade to <strong>Core</strong> to create personalized rituals tailored to your needs.
          </p>
          <button
            onClick={() => showGenericUpgrade('audio')}
            className="w-full px-6 py-3 bg-[#3B3632] dark:bg-gray-700 text-white rounded-xl hover:bg-[#2A2621] dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Upgrade to Core ({getDisplayPrice('core')})
          </button>
          <button
            onClick={() => navigate('/rituals')}
            className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 underline"
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
      <div className="h-screen overflow-y-auto bg-[#F9F6F1] dark:bg-gray-900 overscroll-contain">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="flex-1">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              </div>
              <div className="w-32 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-4">
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
    <div className="h-screen overflow-y-auto bg-[#F9F6F1] dark:bg-gray-900 overscroll-contain safe-top safe-bottom">
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

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 safe-left safe-right">
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
            
            {/* ✅ PHASE 3: Preview Button */}
            {steps.length > 0 && (
              <button
                onClick={() => setPreviewMode(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-[#E8DCC8] dark:border-gray-700 text-[#3B3632] dark:text-white 
                  rounded-xl hover:bg-[#F9F6F1] dark:hover:bg-gray-700 transition-all hover:shadow-md active:scale-95
                  min-h-[44px]"
                aria-label="Preview ritual"
              >
                <Eye size={18} />
                <span className="font-medium">Preview</span>
              </button>
            )}
            
            {/* ✅ PHASE 2: Undo/Redo Buttons */}
            <div className="hidden sm:flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Undo (Cmd+Z)"
                title="Undo (Cmd+Z)"
              >
                <Undo size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Redo (Cmd+Shift+Z)"
                title="Redo (Cmd+Shift+Z)"
              >
                <Redo size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* ✅ PHASE 1: Unsaved Changes Indicator */}
              {hasUnsavedChanges && !saving && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block"
                >
                  Unsaved changes
                </motion.div>
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
                {saving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Save size={20} />
                    </motion.div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Save Ritual</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: Stack vertically, Desktop: 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Step Library - More accessible on mobile, but still accessible */}
          <div className={`lg:col-span-1 ${isMobile ? 'order-2 mt-4' : ''}`} data-step-library>
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-[#E8DCC8] dark:border-gray-700 p-4 sm:p-6 lg:sticky lg:top-4 safe-bottom">
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
                  id="ritual-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Morning Energy Boost"
                  maxLength={100}
                  aria-required="true"
                  aria-invalid={!title.trim()}
                  aria-describedby="title-help"
                  className={`w-full px-4 py-2 sm:py-3 border rounded-lg 
                    focus:outline-none focus:ring-2 focus:border-transparent
                    text-base min-h-[48px] transition-colors
                    ${!title.trim() && hasUnsavedChanges
                      ? 'border-yellow-300 focus:ring-yellow-500'
                      : 'border-gray-300 focus:ring-[#B2BDA3]'
                    }`}
                />
                <div id="title-help" className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>Enter a descriptive name for your ritual</span>
                  <span>{title.length}/100</span>
                </div>
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
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-12 space-y-4"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="inline-block mb-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C8956A] to-[#B8855A] flex items-center justify-center mx-auto">
                      <Sparkles size={32} className="text-white" />
                    </div>
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-bold text-[#3B3632] mb-2">
                      Create Your First Ritual Step
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Drag a step from the library or use a quick start template
                    </p>
                  </div>
                  
                  {/* CTA Button */}
                  <button
                    onClick={() => {
                      // Scroll to step library
                      const libraryElement = document.querySelector('[data-step-library]');
                      if (libraryElement) {
                        libraryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        triggerHaptic(10);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] transition-colors font-medium active:scale-95"
                  >
                    <Plus size={20} />
                    Browse Step Library
                  </button>
                  
                  {/* First-time hint */}
                  {isMobile && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mx-auto max-w-xs mt-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-left">
                          <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">Pro tip:</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400">
                            Drag steps to reorder them. Tap any step to customize duration and instructions.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <DndContext 
                  collisionDetection={closestCenter} 
                  onDragEnd={handleDragEndWithOverlay}
                  onDragStart={handleDragStartWithOverlay}
                  sensors={sensors}
                >
                  <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <AnimatePresence mode="popLayout">
                      <div className="space-y-3">
                        {steps.map((step, index) => (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                          >
                            <SortableStepCard
                              step={step}
                              index={index}
                              totalSteps={steps.length}
                              onEdit={handleEditStep}
                              onDelete={(stepId) => {
                                const step = steps.find(s => s.id === stepId);
                                if (step) handleDeleteWithConfirmation(step);
                              }}
                              onDuplicate={handleDuplicateStep}
                              onKeyboardReorder={handleKeyboardReorder}
                              triggerHaptic={triggerHaptic}
                              isMobile={isMobile}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </AnimatePresence>
                  </SortableContext>
                  
                  {/* ✅ PHASE 1: Drag Overlay */}
                  <DragOverlay>
                    {activeStep ? (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-[#C8956A] shadow-2xl p-4 opacity-95 rotate-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${STEP_TYPE_DEFINITIONS[activeStep.type].color}`}>
                            {React.createElement(STEP_TYPE_DEFINITIONS[activeStep.type].icon, { size: 20 })}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-[#3B3632]">
                              {activeStep.config.title}
                            </div>
                            <div className="text-xs text-gray-600">{activeStep.duration} min</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
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
        <MobileBottomSheet
          isOpen={showMobileConfig}
          onClose={() => {
            triggerHaptic(10);
            setShowMobileConfig(false);
            setSelectedStep(null);
          }}
          keyboardHeight={isKeyboardOpen ? keyboardHeight : 0}
        >
          <StepConfigPanel
            step={selectedStep}
            onUpdate={(updated) => {
              handleUpdateStep(updated);
              triggerHaptic(50);
            }}
            onClose={() => {
              triggerHaptic(10);
              setShowMobileConfig(false);
              setSelectedStep(null);
            }}
          />
        </MobileBottomSheet>
      )}

      {/* ✅ PHASE 1: Delete Confirmation Dialog */}
      <ConfirmDeleteStepDialog
        isOpen={!!stepToDelete}
        step={stepToDelete}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
      />

      {/* ✅ PHASE 1: Draft Restore Prompt */}
      <AnimatePresence>
        {showDraftRestorePrompt && draftSavedAt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              // Close on backdrop click - treat as "Start Fresh"
              setShowDraftRestorePrompt(false);
              try {
                localStorage.removeItem(`ritual-draft-${userId || 'anonymous'}`);
              } catch (error) {
                // Ignore localStorage errors
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Restore Draft?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  We found a draft saved at {draftSavedAt.toLocaleTimeString()}. Would you like to restore it?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDraftRestorePrompt(false);
                      try {
                        localStorage.removeItem(`ritual-draft-${userId || 'anonymous'}`);
                      } catch (error) {
                        // Ignore localStorage errors
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors active:scale-95"
                  >
                    Start Fresh
                  </button>
                  <button
                    onClick={() => {
                      restoreDraft();
                      setShowDraftRestorePrompt(false);
                    }}
                    className="flex-1 px-4 py-2 bg-[#3B3632] hover:bg-[#2A2621] text-white rounded-lg font-medium transition-colors active:scale-95"
                  >
                    Restore Draft
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ PHASE 1: Draft Saved Indicator */}
      <AnimatePresence>
        {showDraftSavedIndicator && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2"
          >
            <Check size={16} className="text-green-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Draft saved</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

