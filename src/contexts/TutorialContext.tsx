/**
 * Tutorial Context
 * Global tutorial state management
 * Follows Atlas context patterns (similar to UpgradeModalContext)
 */

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '../lib/logger';
import { useAuth } from '../providers/AuthProvider';
import { checkTutorialCompletion, markTutorialCompleted } from '../services/tutorialService';

interface TutorialContextType {
  isTutorialActive: boolean;
  currentStep: number;
  isCompleted: boolean;
  isLoading: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 🔥 Guard ref to prevent concurrent tutorial completion checks (prevents React #310 loops)
  const checkingRef = useRef(false);

  // ✅ DEBUG: Log when TutorialProvider initializes (dev only)
  useEffect(() => {
    logger.debug('[TutorialContext] 🚀 TutorialProvider mounted', { 
      hasUser: !!user, 
      userId: user?.id,
      authLoading 
    });
  }, []);

  // ✅ Check tutorial completion status on mount and when user changes
  // 🔥 FIX: Added checkingRef guard to prevent infinite loops (React #310)
  useEffect(() => {
    // 🔥 Guard 1 — auth still loading → do nothing
    if (authLoading) {
      logger.debug('[TutorialContext] ⏳ Auth still loading...');
      return;
    }

    // 🔥 Guard 2 — no user → clear and exit
    if (!user?.id) {
      logger.info("[TutorialContext] Skipping tutorial — no user session");
      setIsLoading(false);
      return;
    }

    // 🔥 Guard 3 — a check is already in progress → skip to avoid loops
    if (checkingRef.current) {
      logger.debug('[TutorialContext] ⏳ Tutorial check already in progress, skipping re-run', {
        userId: user.id,
      });
      return;
    }

    checkingRef.current = true;

    logger.debug('[TutorialContext] 🔄 Effect triggered', { 
      hasUser: !!user, 
      userId: user.id,
      authLoading 
    });

    const checkCompletion = async () => {
      setIsLoading(true);
      logger.debug('[TutorialContext] 🔍 Checking tutorial completion...', { userId: user.id });
      logger.info('[TutorialContext] 🔍 Checking tutorial completion...', { userId: user.id });
      
      try {
        const status = await checkTutorialCompletion(user.id);
        logger.debug('[TutorialContext] ✅ Check complete:', { 
          isCompleted: status.isCompleted, 
          source: status.source,
          userId: user.id 
        });
        logger.info('[TutorialContext] ✅ Check complete:', { 
          isCompleted: status.isCompleted, 
          source: status.source,
          userId: user.id 
        });
        
        setIsCompleted(status.isCompleted);
        
        if (status.isCompleted) {
          logger.debug('[TutorialContext] ⏭️ Tutorial already completed, skipping');
          logger.info('[TutorialContext] ⏭️ Tutorial already completed, skipping');
          setIsTutorialActive(false);
        } else {
          logger.debug('[TutorialContext] ✅ Tutorial NOT completed, ready to show');
          logger.info('[TutorialContext] ✅ Tutorial NOT completed, ready to show');
        }
      } catch (error) {
        logger.error('[TutorialContext] ❌ Error checking tutorial completion', {
          error,
          userId: user.id
        });
        // On error, assume not completed (safer to show tutorial than hide it)
        setIsCompleted(false);
      } finally {
        setIsLoading(false);
        checkingRef.current = false; // 🔑 Reset guard to allow future legitimate checks
      }
    };

    void checkCompletion();
  }, [user?.id, authLoading]);

  // ✅ 100% BEST PRACTICES: Memoize callbacks to prevent unnecessary re-renders
  const startTutorial = useCallback(() => {
    if (isCompleted) {
      logger.warn('[TutorialContext] ⚠️ Attempted to start tutorial but already completed');
      return;
    }
    setIsTutorialActive(true);
    setCurrentStep(0);
    logger.info('[TutorialContext] 🎓 Tutorial started');
  }, [isCompleted]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const skipTutorial = useCallback(async () => {
    setIsTutorialActive(false);
    setCurrentStep(0);
    
    // Mark as completed when skipped (user doesn't want to see it)
    if (user?.id) {
      try {
        await markTutorialCompleted(user.id);
        setIsCompleted(true);
        logger.info('[TutorialContext] ✅ Tutorial skipped and marked as completed');
      } catch (error) {
        logger.error('[TutorialContext] Error marking tutorial as skipped:', error);
      }
    }
  }, [user?.id]);

  const completeTutorial = useCallback(async () => {
    setIsTutorialActive(false);
    setCurrentStep(0);
    
    if (user?.id) {
      try {
        await markTutorialCompleted(user.id);
        setIsCompleted(true);
        logger.info('[TutorialContext] ✅ Tutorial completed successfully');
      } catch (error) {
        logger.error('[TutorialContext] Error marking tutorial as completed:', error);
        // Still mark as completed in state so tutorial doesn't show again
        setIsCompleted(true);
      }
    }
  }, [user?.id]);

  // ✅ 100% BEST PRACTICES: Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      isTutorialActive,
      currentStep,
      isCompleted,
      isLoading,
      startTutorial,
      nextStep,
      previousStep,
      skipTutorial,
      completeTutorial,
    }),
    [
      isTutorialActive,
      currentStep,
      isCompleted,
      isLoading,
      startTutorial,
      nextStep,
      previousStep,
      skipTutorial,
      completeTutorial,
    ]
  );

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}

