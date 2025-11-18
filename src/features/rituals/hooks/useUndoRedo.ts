/**
 * Undo/Redo Hook for Ritual Builder
 * Implements command pattern for undo/redo functionality
 */

import { useCallback, useRef, useState } from 'react';
import type { RitualStep } from '../types/rituals';

interface HistoryState {
  steps: RitualStep[];
  timestamp: number;
}

interface UseUndoRedoReturn {
  undo: () => RitualStep[] | null;
  redo: () => RitualStep[] | null;
  canUndo: boolean;
  canRedo: boolean;
  addToHistory: (steps: RitualStep[]) => void;
  clearHistory: () => void;
  getCurrentSteps: () => RitualStep[];
}

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo(initialSteps: RitualStep[] = []): UseUndoRedoReturn {
  const [history, setHistory] = useState<HistoryState[]>([
    { steps: [...initialSteps], timestamp: Date.now() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoingRef = useRef(false);

  const addToHistory = useCallback((steps: RitualStep[]) => {
    // Skip if we're in the middle of an undo/redo operation
    if (isUndoingRef.current) return;

    setHistory(prev => {
      // Remove any states after current index (when user makes new change after undo)
      const newHistory = prev.slice(0, historyIndex + 1);
      
      // Add new state
      const newState: HistoryState = {
        steps: [...steps], // Deep copy
        timestamp: Date.now(),
      };
      
      const updated = [...newHistory, newState];
      
      // Limit history size to MAX_HISTORY_SIZE
      if (updated.length > MAX_HISTORY_SIZE) {
        return updated.slice(-MAX_HISTORY_SIZE);
      }
      
      return updated;
    });
    
    setHistoryIndex(prev => {
      const newIndex = prev + 1;
      // Ensure index doesn't exceed history length
      return Math.min(newIndex, MAX_HISTORY_SIZE - 1);
    });
  }, [historyIndex]);

  const undo = useCallback((): RitualStep[] | null => {
    if (historyIndex <= 0) return null;

    isUndoingRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    
    const previousState = history[newIndex];
    isUndoingRef.current = false;
    
    return previousState ? [...previousState.steps] : null;
  }, [history, historyIndex]);

  const redo = useCallback((): RitualStep[] | null => {
    if (historyIndex >= history.length - 1) return null;

    isUndoingRef.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    
    const nextState = history[newIndex];
    isUndoingRef.current = false;
    
    return nextState ? [...nextState.steps] : null;
  }, [history, historyIndex]);

  const clearHistory = useCallback(() => {
    const currentSteps = historyIndex >= 0 && historyIndex < history.length 
      ? history[historyIndex].steps 
      : [];
    setHistory([{ steps: [...currentSteps], timestamp: Date.now() }]);
    setHistoryIndex(0);
  }, [history, historyIndex]);

  const getCurrentSteps = useCallback((): RitualStep[] => {
    if (historyIndex >= 0 && historyIndex < history.length) {
      return [...history[historyIndex].steps];
    }
    return [];
  }, [history, historyIndex]);

  return {
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    addToHistory,
    clearHistory,
    getCurrentSteps,
  };
}

