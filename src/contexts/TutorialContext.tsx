/**
 * Tutorial Context
 * Global tutorial state management
 * Follows Atlas context patterns (similar to UpgradeModalContext)
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { checkTutorialCompletion, markTutorialCompleted } from '../services/tutorialService';
import { logger } from '../lib/logger';

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

  // ✅ DEBUG: Log when TutorialProvider initializes (dev only)
  useEffect(() => {
    logger.debug('[TutorialContext] 🚀 TutorialProvider mounted', { 
      hasUser: !!user, 
      userId: user?.id,
      authLoading 
    });
  }, []);

  // Check tutorial completion status on mount and when user changes
  useEffect(() => {
    // 🚫 Guard: skip tutorial if no user is logged in
    if (!user) {
      logger.info("[TutorialContext] Skipping tutorial — no user session");
      setIsLoading(false);
      return;
    }

    // ✅ DEBUG: Log when this effect runs (dev only)
    logger.debug('[TutorialContext] 🔄 Effect triggered', { 
      hasUser: !!user, 
      userId: user?.id,
      authLoading 
    });

    const checkCompletion = async () => {
      setIsLoading(true);
      logger.debug('[TutorialContext] 🔍 Checking tutorial completion...', { userId: user?.id });
      logger.info('[TutorialContext] 🔍 Checking tutorial completion...', { userId: user?.id });
      
      try {
        const status = await checkTutorialCompletion(user?.id || null);
        logger.debug('[TutorialContext] ✅ Check complete:', { 
          isCompleted: status.isCompleted, 
          source: status.source,
          userId: user?.id 
        });
        logger.info('[TutorialContext] ✅ Check complete:', { 
          isCompleted: status.isCompleted, 
          source: status.source,
          userId: user?.id 
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
        logger.error('[TutorialContext] ❌ Error checking tutorial completion:', error);
        // On error, assume not completed (safer to show tutorial than hide it)
        setIsCompleted(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Wait for auth to finish loading, then check
    if (!authLoading) {
      if (user?.id) {
        checkCompletion();
      } else {
        logger.debug('[TutorialContext] ⏳ No user after auth loaded');
        logger.info('[TutorialContext] ⏳ No user after auth loaded');
        setIsLoading(false);
      }
    } else {
      logger.debug('[TutorialContext] ⏳ Auth still loading...');
      logger.info('[TutorialContext] ⏳ Auth still loading...');
    }
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

