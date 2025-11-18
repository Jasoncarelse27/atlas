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
import { retry } from '@/utils/retry';

import { analyzeRitual, getQuickStartTemplate, type RitualSuggestion } from '../services/ritualSuggestions';
import type { Ritual, RitualGoal, RitualStep, RitualStepType } from '../types/rituals';
import { normalizeStepDurations, prepareStepsForStorage } from '../utils/durationUtils';
import { STEP_TYPE_DEFINITIONS } from '../components/StepLibrary';
import { useRitualStore } from './useRitualStore';
import { useUndoRedo } from './useUndoRedo';

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
  hasUnsavedChanges: boolean;
  draftSavedAt: Date | null;
  restoreDraft: () => void;
  canUndo: boolean;
  canRedo: boolean;
  handleUndo: () => void;
  handleRedo: () => void;

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
  const initialSteps = (() => {
    if (editRitual?.steps) {
      return normalizeStepDurations(editRitual.steps) as RitualStep[];
    }
    return [];
  })();
  const [steps, setSteps] = useState<RitualStep[]>(initialSteps);
  
  // ✅ PHASE 2: Undo/Redo system
  const { undo, redo, canUndo, canRedo, addToHistory, clearHistory } = useUndoRedo(initialSteps);
  const isInitialMountRef = useRef(true);
  const skipHistoryRef = useRef(false);
  
  // Track steps changes for undo/redo history
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    
    // Skip if we're restoring from undo/redo
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    
    addToHistory(steps);
  }, [steps, addToHistory]);
  const [selectedStep, setSelectedStep] = useState<RitualStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Smart suggestions with debounce
  const [suggestions, setSuggestions] = useState<RitualSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile: Show config as bottom sheet
  const [showMobileConfig, setShowMobileConfig] = useState(false);

  // ✅ PHASE 1: Auto-save & Draft Recovery
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DRAFT_STORAGE_KEY = `ritual-draft-${userId || 'anonymous'}`;
  const DRAFT_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

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

  // ✅ PHASE 1: Restore draft on mount (if exists and valid)
  useEffect(() => {
    if (!userId || isEditing) {
      // Clear draft if editing existing ritual
      if (isEditing) {
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
          setDraftSavedAt(null);
        } catch (error) {
          // Ignore
        }
      }
      return;
    }

    try {
      const draftData = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draftData) {
        setDraftSavedAt(null);
        return;
      }

      const draft = JSON.parse(draftData);
      const draftAge = Date.now() - draft.timestamp;

      // Only restore if draft is less than 1 hour old and belongs to current user
      if (draftAge < DRAFT_EXPIRY_MS && draft.userId === userId) {
        // Set flag to show restore prompt (component will handle prompt)
        setDraftSavedAt(new Date(draft.timestamp));
        // Don't auto-restore - let user decide via prompt
      } else {
        // Clean up expired or invalid draft
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftSavedAt(null);
      }
    } catch (error) {
      logger.debug('[RitualBuilder] Failed to parse draft:', error);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {
        // Ignore
      }
      setDraftSavedAt(null);
    }
  }, [userId, isEditing, DRAFT_STORAGE_KEY]);

  // ✅ PHASE 1: Auto-save draft (debounced, 2s delay)
  useEffect(() => {
    // Don't auto-save if editing existing ritual or no changes
    if (isEditing || (!title.trim() && steps.length === 0)) {
      setHasUnsavedChanges(false);
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set unsaved changes flag
    setHasUnsavedChanges(true);

    // Debounce auto-save (2 seconds)
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const draft = {
          title,
          goal,
          steps,
          timestamp: Date.now(),
          userId,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        setDraftSavedAt(new Date());
        logger.debug('[RitualBuilder] Draft auto-saved');
      } catch (error) {
        logger.error('[RitualBuilder] Failed to save draft:', error);
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, goal, steps, userId, isEditing, DRAFT_STORAGE_KEY]);

  // ✅ PHASE 1: Warn before leaving with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ✅ PHASE 2: Undo handler
  const handleUndo = useCallback(() => {
    const restoredSteps = undo();
    if (restoredSteps) {
      skipHistoryRef.current = true; // Prevent adding undo action to history
      setSteps(restoredSteps);
      triggerHaptic(10);
      toast.success('Undone', { duration: 1500 });
    }
  }, [undo, triggerHaptic]);

  // ✅ PHASE 2: Redo handler
  const handleRedo = useCallback(() => {
    const restoredSteps = redo();
    if (restoredSteps) {
      skipHistoryRef.current = true; // Prevent adding redo action to history
      setSteps(restoredSteps);
      triggerHaptic(10);
      toast.success('Redone', { duration: 1500 });
    }
  }, [redo, triggerHaptic]);

  // ✅ PHASE 1: Restore draft function
  const restoreDraft = useCallback(() => {
    try {
      const draftData = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draftData) {
        setDraftSavedAt(null);
        return;
      }

      const draft = JSON.parse(draftData);
      if (draft.userId === userId) {
        setTitle(draft.title || '');
        setGoal(draft.goal || 'focus');
        setSteps(draft.steps || []);
        // Keep draftSavedAt so user knows it was restored
        setHasUnsavedChanges(true);
        toast.success('Draft restored', {
          description: 'Your previous work has been restored',
          duration: 3000,
        });
      } else {
        // Draft belongs to different user, clear it
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftSavedAt(null);
      }
    } catch (error) {
      logger.error('[RitualBuilder] Failed to restore draft:', error);
      // Clear corrupted draft
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {
        // Ignore
      }
      setDraftSavedAt(null);
      toast.error('Failed to restore draft', {
        description: 'The draft may be corrupted',
        duration: 3000,
      });
    }
  }, [userId, DRAFT_STORAGE_KEY, setTitle, setGoal, setSteps]);

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

    setSteps(prev => {
      const updated = [...prev, newStep];
      // History tracking happens in useEffect
      return updated;
    });
    triggerHaptic(50);
    toast.success(`Added ${stepDef.label}`, {
      duration: 2000,
    });
  }, [steps.length, triggerHaptic]);

  // Delete step handler
  const handleDeleteStep = useCallback((stepId: string) => {
    setSteps(prev => {
      const updated = prev.filter((s) => s.id !== stepId);
      // History tracking happens in useEffect
      return updated;
    });
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
    setSteps(prev => {
      const updated = prev.map((s) => (s.id === updatedStep.id ? updatedStep : s));
      // History tracking happens in useEffect
      return updated;
    });
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

        // History tracking happens in useEffect
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

      // ✅ BEST PRACTICE: Retry mechanism for network errors
      await retry(
        async () => {
          await createRitual({
            userId,
            title: title.trim(),
            goal,
            steps: stepsWithCorrectDuration,
            isPreset: false,
            tierRequired: tier,
          });
        },
        3, // 3 retries
        1000 // Start with 1s delay, exponential backoff
      );

      toast.dismiss(loadingToast);
      // ✅ PHASE 1: Clear draft on successful save
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setHasUnsavedChanges(false);
        setDraftSavedAt(null);
      } catch (error) {
        logger.debug('[RitualBuilder] Failed to clear draft:', error);
      }

      // ✅ PHASE 2: Clear undo/redo history on successful save
      clearHistory();

      toast.success('✨ Ritual saved successfully!', {
        description: `${title.trim()} has been added to your library`,
        duration: 3000,
      });
      navigate('/rituals');
    } catch (error) {
      logger.error('[RitualBuilder] Failed to save ritual:', error);
      toast.dismiss(loadingToast);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // ✅ BEST PRACTICE: Actionable error messages with recovery options
      if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        toast.error('Network error', {
          description: 'Please check your connection and try again',
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => handleSave(),
          },
        });
      } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        toast.error('Permission denied', {
          description: 'You may need to sign in again. Please try refreshing the page.',
          duration: 5000,
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload(),
          },
        });
      } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        toast.error('Validation error', {
          description: 'Please check your ritual details and try again',
          duration: 5000,
        });
      } else {
        toast.error('Failed to save ritual', {
          description: errorMessage,
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => handleSave(),
          },
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
  };
}
