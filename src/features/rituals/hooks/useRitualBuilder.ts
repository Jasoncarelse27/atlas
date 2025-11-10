/**
 * Ritual Builder Hook
 * Manages all state and logic for the Ritual Builder component
 * Extracted for better testability and maintainability
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useTierQuery } from '@/hooks/useTierQuery';
import { logger } from '@/lib/logger';

import { analyzeRitual, getQuickStartTemplate, type RitualSuggestion } from '../services/ritualSuggestions';
import type { Ritual, RitualGoal, RitualStep, RitualStepType } from '../types/rituals';
import { normalizeStepDurations, prepareStepsForStorage } from '../utils/durationUtils';
import { STEP_TYPE_DEFINITIONS } from '../components/StepLibrary';
import { useRitualStore } from './useRitualStore';

interface UseRitualBuilderReturn {
  // State
  title: string;
  setTitle: (title: string) => void;
  goal: RitualGoal;
  setGoal: (goal: RitualGoal) => void;
  steps: RitualStep[];
  setSteps: (steps: RitualStep[] | ((prev: RitualStep[]) => RitualStep[])) => void;
  selectedStep: RitualStep | null;
  setSelectedStep: (step: RitualStep | null) => void;
  saving: boolean;
  isInitializing: boolean;
  suggestions: RitualSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  showMobileConfig: boolean;
  setShowMobileConfig: (show: boolean) => void;
  totalDuration: number;
  isEditing: boolean;

  // Actions
  handleAddStep: (stepType: RitualStepType) => void;
  handleDeleteStep: (stepId: string) => void;
  handleDuplicateStep: (stepId: string) => void;
  handleUpdateStep: (updatedStep: RitualStep) => void;
  handleEditStep: (step: RitualStep) => void;
  handleKeyboardReorder: (stepId: string, direction: 'up' | 'down') => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleSave: () => Promise<void>;

  // Navigation
  navigate: ReturnType<typeof useNavigate>;
  
  // Context
  tier: string;
  userId: string;
  showGenericUpgrade: (feature: string) => void;
  isMobile: boolean;
  triggerHaptic: (duration: number) => void;
}

export function useRitualBuilder(): UseRitualBuilderReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const { tier, userId } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const { createRitual } = useRitualStore();
  const { isMobile, triggerHaptic } = useMobileOptimization();

  // Check if we're editing an existing ritual
  const editRitual = location.state?.editRitual as Ritual | undefined;
  const isEditing = !!editRitual;

  // Initialize state from editRitual if editing
  const [title, setTitle] = useState(editRitual?.title || '');
  const [goal, setGoal] = useState<RitualGoal>(editRitual?.goal || 'focus');
  const [steps, setSteps] = useState<RitualStep[]>(() => {
    if (editRitual?.steps) {
      return normalizeStepDurations(editRitual.steps) as RitualStep[];
    }
    return [];
  });
  const [selectedStep, setSelectedStep] = useState<RitualStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Smart suggestions with debounce
  const [suggestions, setSuggestions] = useState<RitualSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile: Show config as bottom sheet
  const [showMobileConfig, setShowMobileConfig] = useState(false);

  // Debounced suggestions analysis (300ms delay)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const newSuggestions = analyzeRitual(steps, goal);
      setSuggestions(newSuggestions);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [steps, goal]);

  // Initialize component (simulate loading for skeleton)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Calculate total duration
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  // Add step handler
  const handleAddStep = useCallback((stepType: RitualStepType) => {
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

    setSteps(prev => [...prev, newStep]);
    triggerHaptic(50);
    toast.success(`Added ${stepDef.label}`, {
      duration: 2000,
    });
  }, [steps.length, triggerHaptic]);

  // Delete step handler
  const handleDeleteStep = useCallback((stepId: string) => {
    setSteps(prev => prev.filter((s) => s.id !== stepId));
    setSelectedStep(prev => {
      if (prev?.id === stepId) {
        if (isMobile) setShowMobileConfig(false);
        return null;
      }
      return prev;
    });
    toast.success('Step removed', {
      duration: 2000,
    });
  }, [isMobile]);

  // Duplicate step handler
  const handleDuplicateStep = useCallback((stepId: string) => {
    setSteps(prev => {
      const stepToDuplicate = prev.find(s => s.id === stepId);
      if (!stepToDuplicate) return prev;

      const duplicatedStep: RitualStep = {
        ...stepToDuplicate,
        id: uuidv4(),
        order: prev.length,
      };

      triggerHaptic(50);
      toast.success(`Duplicated ${stepToDuplicate.config.title}`, {
        duration: 2000,
      });
      return [...prev, duplicatedStep];
    });
  }, [triggerHaptic]);

  // Update step handler
  const handleUpdateStep = useCallback((updatedStep: RitualStep) => {
    setSteps(prev => prev.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
  }, []);

  // Edit step handler
  const handleEditStep = useCallback((step: RitualStep) => {
    setSelectedStep(step);
    if (isMobile) {
      setShowMobileConfig(true);
    }
  }, [isMobile]);

  // Keyboard reorder handler
  const handleKeyboardReorder = useCallback((stepId: string, direction: 'up' | 'down') => {
    setSteps(prev => {
      const currentIndex = prev.findIndex(s => s.id === stepId);
      if (currentIndex === -1) return prev;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const reordered = arrayMove(prev, currentIndex, newIndex).map((step, index) => ({
        ...step,
        order: index,
      }));

      triggerHaptic(50);
      return reordered;
    });
  }, [triggerHaptic]);

  // Drag handlers
  const handleDragStart = useCallback((_event: DragStartEvent) => {
    triggerHaptic(10);
  }, [triggerHaptic]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps(prev => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);

        const reordered = arrayMove(prev, oldIndex, newIndex).map((step, index) => ({
          ...step,
          order: index,
        }));

        triggerHaptic(50);
        return reordered;
      });
    } else {
      triggerHaptic(10);
    }
  }, [triggerHaptic]);

  // Save handler
  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      toast.error('Please enter a ritual title', {
        description: 'A title helps you identify your ritual later',
        duration: 3000,
      });
      return;
    }

    if (title.trim().length > 100) {
      toast.error('Title too long', {
        description: 'Ritual title must be 100 characters or less',
        duration: 3000,
      });
      return;
    }

    if (steps.length === 0) {
      toast.error('Add at least one step', {
        description: 'Your ritual needs at least one step to be saved',
        duration: 3000,
      });
      return;
    }

    if (steps.length > 10) {
      toast.error('Too many steps', {
        description: 'Rituals can have a maximum of 10 steps',
        duration: 3000,
      });
      return;
    }

    if (!userId) {
      toast.error('Please sign in', {
        description: 'You must be logged in to save rituals',
        duration: 3000,
      });
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saving ritual...', {
      description: 'Please wait while we save your ritual',
    });

    try {
      const stepsWithCorrectDuration = prepareStepsForStorage(steps) as RitualStep[];

      await createRitual({
        userId,
        title: title.trim(),
        goal,
        steps: stepsWithCorrectDuration,
        isPreset: false,
        tierRequired: tier,
      });

      toast.dismiss(loadingToast);
      toast.success('✨ Ritual saved successfully!', {
        description: `${title.trim()} has been added to your library`,
        duration: 3000,
      });
      navigate('/rituals');
    } catch (error) {
      logger.error('[RitualBuilder] Failed to save ritual:', error);
      toast.dismiss(loadingToast);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Network error', {
          description: 'Please check your connection and try again',
          duration: 5000,
        });
      } else {
        toast.error('Failed to save ritual', {
          description: errorMessage,
          duration: 5000,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return {
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
    userId,
    showGenericUpgrade,
    isMobile,
    triggerHaptic,
  };
}
