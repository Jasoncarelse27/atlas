/**
 * Tutorial Overlay Component
 * Mobile-responsive tutorial system with spotlight effect
 * Follows Atlas modal patterns (AnimatePresence, backdrop blur, body scroll lock)
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTutorial } from '../../hooks/useTutorial';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';
import { useTierQuery } from '../../hooks/useTierQuery';
import { TUTORIAL_STEPS, getTutorialStepsForTier, type TutorialStep } from '../../config/tutorialSteps';
import { logger } from '../../lib/logger';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export function TutorialOverlay() {
  const { isTutorialActive, currentStep, nextStep, previousStep, skipTutorial, completeTutorial } = useTutorial();
  const { isMobile } = useMobileOptimization();
  const { tier } = useTierQuery();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // ✅ 100% BEST PRACTICES: Check for reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current;

  // ✅ 100% BEST PRACTICES: Focus trap for accessibility (WCAG 2.4.3)
  useFocusTrap({
    isActive: isTutorialActive,
    containerRef: tooltipRef,
    initialFocusRef: firstButtonRef,
    restoreFocus: true,
  });

  // Get filtered steps based on tier
  const steps = getTutorialStepsForTier(tier || 'free');
  const currentStepData = steps[currentStep];

  // Safety check: if step is out of bounds, complete tutorial
  useEffect(() => {
    if (isTutorialActive && (!currentStepData || currentStep >= steps.length)) {
      logger.warn('[TutorialOverlay] Step out of bounds, completing tutorial');
      completeTutorial();
    }
  }, [isTutorialActive, currentStep, currentStepData, steps.length, completeTutorial]);

  // Body scroll lock (follows Atlas modal pattern)
  useEffect(() => {
    if (isTutorialActive) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isTutorialActive]);

  // Calculate tooltip position (memoized for performance)
  const calculateTooltipPosition = useCallback((element: HTMLElement) => {
    if (!currentStepData) return;
    
    const rect = element.getBoundingClientRect();
    const position = isMobile ? currentStepData.position.mobile : currentStepData.position.desktop;
    const offset = isMobile ? currentStepData.offset?.mobile : currentStepData.offset?.desktop;

    let top = 0;
    let left = 0;

    // ✅ MOBILE FIX: Center tooltip on mobile for better UX (especially for welcome/center steps)
    if (isMobile && (position === 'center' || currentStepData.id === 'welcome' || currentStepData.id === 'complete')) {
      // Center vertically and horizontally on mobile
      top = window.innerHeight / 2;
      left = window.innerWidth / 2;
    } else {
      switch (position) {
        case 'top':
          top = rect.top - 20;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + 20;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - 20;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + 20;
          break;
        case 'center':
          top = window.innerHeight / 2;
          left = window.innerWidth / 2;
          break;
      }
    }

    // Apply offsets
    if (offset) {
      top += offset.y || 0;
      left += offset.x || 0;
    }

    // Ensure tooltip stays within viewport (with safe area padding on mobile)
    const tooltipWidth = isMobile ? Math.min(320, window.innerWidth - 32) : 320; // Responsive width
    const tooltipHeight = isMobile ? 250 : 200; // Slightly taller on mobile for better readability

    // Viewport bounds with safe area insets
    const safeAreaTop = isMobile ? 20 : 0;
    const safeAreaBottom = isMobile ? 80 : 0; // Account for browser UI
    const safeAreaLeft = isMobile ? 16 : 0;
    const safeAreaRight = isMobile ? 16 : 0;

    // ✅ MOBILE FIX: For centered steps, ensure perfect centering
    if (isMobile && (position === 'center' || currentStepData.id === 'welcome' || currentStepData.id === 'complete')) {
      // Force perfect center on mobile
      left = window.innerWidth / 2;
      top = window.innerHeight / 2;
    } else {
      // Constrain to viewport for other positions
      if (left < tooltipWidth / 2 + safeAreaLeft) left = tooltipWidth / 2 + safeAreaLeft;
      if (left > window.innerWidth - tooltipWidth / 2 - safeAreaRight) left = window.innerWidth - tooltipWidth / 2 - safeAreaRight;
      if (top < tooltipHeight / 2 + safeAreaTop) top = tooltipHeight / 2 + safeAreaTop;
      if (top > window.innerHeight - tooltipHeight / 2 - safeAreaBottom) top = window.innerHeight - tooltipHeight / 2 - safeAreaBottom;
    }

    setTooltipPosition({ top, left });
  }, [currentStepData, isMobile]);

  // Find target element and calculate tooltip position
  useEffect(() => {
    if (!isTutorialActive || !currentStepData) return;

    const findTargetElement = () => {
      try {
        // Try to find element by selector
        let element: HTMLElement | null = null;

        // Handle different selector types
        if (currentStepData.targetSelector === 'body') {
          element = document.body;
          // ✅ MOBILE FIX: For body/center steps, set position immediately without waiting for element
          if (isMobile && (currentStepData.position.mobile === 'center' || currentStepData.id === 'welcome' || currentStepData.id === 'complete')) {
            setTooltipPosition({ 
              top: window.innerHeight / 2, 
              left: window.innerWidth / 2 
            });
            return; // Early return for centered mobile steps
          }
        } else {
          // Try querySelector first
          element = document.querySelector(currentStepData.targetSelector) as HTMLElement;

          // Fallback: try to find by data attribute or aria-label
          if (!element) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
              const ariaLabel = btn.getAttribute('aria-label') || '';
              if (ariaLabel.toLowerCase().includes('menu')) {
                element = btn;
                break;
              }
            }
          }
        }

        if (element) {
          setTargetElement(element);
          calculateTooltipPosition(element);
        } else {
          logger.warn('[TutorialOverlay] Target element not found:', currentStepData.targetSelector);
          // Fallback to center position
          setTooltipPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        }
      } catch (error) {
        logger.error('[TutorialOverlay] Error finding target element:', error);
        // Fallback to center position
        setTooltipPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
      }
    };

    // Wait for DOM to be ready
    const timer = setTimeout(findTargetElement, 100);
    
    // ✅ POLISH: Reposition on resize/scroll for spotlight accuracy
    const handleResize = () => {
      if (targetElement && targetElement !== document.body) {
        calculateTooltipPosition(targetElement);
      } else if (currentStepData) {
        findTargetElement();
      }
    };
    
    const handleScroll = () => {
      if (targetElement && targetElement !== document.body) {
        calculateTooltipPosition(targetElement);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true); // Capture phase for nested scroll
    window.visualViewport?.addEventListener('resize', handleResize); // Mobile keyboard
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [isTutorialActive, currentStep, currentStepData, isMobile, targetElement, calculateTooltipPosition]);

  // Handle keyboard navigation (WCAG AA)
  useEffect(() => {
    if (!isTutorialActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipTutorial();
      } else if (e.key === 'ArrowRight' && currentStep < steps.length - 1) {
        nextStep();
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        previousStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTutorialActive, currentStep, steps.length, nextStep, previousStep, skipTutorial]);

  if (!isTutorialActive || !currentStepData || !tooltipPosition) {
    return null;
  }

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // ✅ FIX: Determine if step should use flexbox centering (matches SearchDrawer pattern)
  const shouldCenter = 
    (isMobile && (currentStepData.position.mobile === 'center' || currentStepData.id === 'welcome' || currentStepData.id === 'complete')) ||
    (!isMobile && currentStepData.position.desktop === 'center');

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-sm overflow-x-hidden"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          // Don't skip if clicking on tutorial tooltip
          const target = e.target as HTMLElement;
          const isTooltip = target.closest('[role="dialog"]');
          
          if (isTooltip) {
            return; // Don't skip if clicking tooltip
          }
          
          // Check if click is on target element area - allow interaction
          if (targetElement && targetElement !== document.body) {
            const rect = targetElement.getBoundingClientRect();
            const clickX = e.clientX;
            const clickY = e.clientY;
            const isOnTarget = 
              clickX >= rect.left - 8 &&
              clickX <= rect.right + 8 &&
              clickY >= rect.top - 8 &&
              clickY <= rect.bottom + 8;
            
            if (isOnTarget) {
              // Allow click to pass through to target element
              e.stopPropagation();
              // Create a new click event on the target element
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: clickX,
                clientY: clickY,
              });
              targetElement.dispatchEvent(clickEvent);
              return; // Don't skip tutorial
            }
          }
          
          // Skip tutorial if clicking backdrop (not tooltip, not target)
          skipTutorial();
        }}
        aria-label="Tutorial overlay"
      >
        {/* Spotlight effect - only show for non-centered steps */}
        {targetElement && targetElement !== document.body && !shouldCenter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="absolute rounded-xl pointer-events-none transition-all duration-200"
            style={{
              top: targetElement.getBoundingClientRect().top - 8,
              left: targetElement.getBoundingClientRect().left - 8,
              width: targetElement.getBoundingClientRect().width + 16,
              height: targetElement.getBoundingClientRect().height + 16,
              borderRadius: '12px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 0 2px rgba(211, 220, 171, 0.4)',
              zIndex: 1,
            }}
          />
        )}

        {/* ✅ FIX: Use flexbox centering for centered steps (matches SearchDrawer pattern) */}
        {shouldCenter ? (
          <motion.div
            className="fixed inset-0 z-[100001] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              const isTooltip = target.closest('[role="dialog"]');
              if (!isTooltip) {
                skipTutorial();
              }
            }}
          >
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', damping: 25, stiffness: 300 }
              }
              className={`bg-atlas-pearl rounded-2xl shadow-2xl border border-atlas-border p-4 sm:p-6 w-full ${
                isMobile ? 'max-w-[calc(100vw-32px)]' : 'max-w-sm'
              }`}
              style={{
                maxHeight: isMobile ? 'calc(100vh - 160px)' : 'none',
                overflowY: 'auto',
                pointerEvents: 'auto',
                paddingLeft: isMobile ? `max(16px, env(safe-area-inset-left, 16px))` : undefined,
                paddingRight: isMobile ? `max(16px, env(safe-area-inset-right, 16px))` : undefined,
                paddingBottom: isMobile ? `max(16px, env(safe-area-inset-bottom, 16px))` : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="tutorial-title"
              aria-describedby="tutorial-description"
            >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3
                id="tutorial-title"
                className="text-xl font-bold text-atlas-text-dark mb-1"
                style={{ fontWeight: 700 }}
              >
                {currentStepData.title}
              </h3>
              <p className="text-sm text-atlas-text-muted">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
            <button
              ref={firstButtonRef}
              onClick={skipTutorial}
              className="p-2 rounded-lg hover:bg-atlas-button transition-colors ml-2"
              aria-label="Skip tutorial"
              style={{ minWidth: '48px', minHeight: '48px' }} // Touch-friendly
            >
              <X className="w-5 h-5 text-atlas-text-medium" />
            </button>
          </div>

          {/* Description */}
          <p
            id="tutorial-description"
            className="text-atlas-text-medium mb-6 leading-relaxed"
          >
            {currentStepData.description}
          </p>

          {/* Progress indicator - Animated */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, index) => (
              <motion.div
                key={index}
                className="h-1 flex-1 rounded-full"
                animate={{
                  backgroundColor:
                    index === currentStep
                      ? 'rgb(211, 220, 171)' // atlas-sage
                      : index < currentStep
                      ? 'rgba(211, 220, 171, 0.5)' // atlas-sage/50
                      : 'rgb(232, 221, 210)', // atlas-border
                  scale: index === currentStep ? 1.05 : 1,
                }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.25,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={skipTutorial}
              className="px-4 py-2 text-atlas-text-medium hover:text-atlas-text-dark transition-colors"
              style={{ minHeight: '48px' }} // Touch-friendly
            >
              Skip
            </button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  onClick={previousStep}
                  className="p-2 rounded-lg bg-atlas-button hover:bg-atlas-button-hover transition-colors"
                  aria-label="Previous step"
                  style={{ minWidth: '48px', minHeight: '48px' }} // Touch-friendly
                >
                  <ChevronLeft className="w-5 h-5 text-atlas-text-medium" />
                </button>
              )}

              {isLastStep ? (
                <button
                  onClick={completeTutorial}
                  className="px-6 py-2 bg-atlas-sage text-white rounded-lg hover:bg-atlas-success transition-colors font-medium active:scale-[0.98]"
                  style={{ minHeight: '48px' }} // Touch-friendly
                >
                  Get Started
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  className="px-6 py-2 bg-atlas-sage text-white rounded-lg hover:bg-atlas-success transition-colors font-medium flex items-center gap-2 active:scale-[0.98]"
                  style={{ minHeight: '48px' }} // Touch-friendly
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
            </motion.div>
          </motion.div>
        ) : (
          /* ✅ FIX: Keep absolute positioning for non-centered steps */
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 25, stiffness: 300 }
            }
            className={`absolute bg-atlas-pearl rounded-2xl shadow-2xl border border-atlas-border p-4 sm:p-6 ${
              isMobile ? 'max-w-[calc(100vw-32px)]' : 'max-w-sm'
            }`}
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 100001,
              pointerEvents: 'auto',
              maxHeight: isMobile ? 'calc(100vh - 160px)' : 'none',
              overflowY: 'auto',
              paddingLeft: isMobile ? `max(16px, env(safe-area-inset-left, 16px))` : undefined,
              paddingRight: isMobile ? `max(16px, env(safe-area-inset-right, 16px))` : undefined,
              paddingBottom: isMobile ? `max(16px, env(safe-area-inset-bottom, 16px))` : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="tutorial-title"
            aria-describedby="tutorial-description"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3
                  id="tutorial-title"
                  className="text-xl font-bold text-atlas-text-dark mb-1"
                  style={{ fontWeight: 700 }}
                >
                  {currentStepData.title}
                </h3>
                <p className="text-sm text-atlas-text-muted">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
              <button
                ref={firstButtonRef}
                onClick={skipTutorial}
                className="p-2 rounded-lg hover:bg-atlas-button transition-colors ml-2"
                aria-label="Skip tutorial"
                style={{ minWidth: '48px', minHeight: '48px' }}
              >
                <X className="w-5 h-5 text-atlas-text-medium" />
              </button>
            </div>

            {/* Description */}
            <p
              id="tutorial-description"
              className="text-atlas-text-medium mb-6 leading-relaxed"
            >
              {currentStepData.description}
            </p>

            {/* Progress indicator - Animated */}
            <div className="flex gap-1 mb-6">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className="h-1 flex-1 rounded-full"
                  animate={{
                    backgroundColor:
                      index === currentStep
                        ? 'rgb(211, 220, 171)'
                        : index < currentStep
                        ? 'rgba(211, 220, 171, 0.5)'
                        : 'rgb(232, 221, 210)',
                    scale: index === currentStep ? 1.05 : 1,
                  }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.25,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={skipTutorial}
                className="px-4 py-2 text-atlas-text-medium hover:text-atlas-text-dark transition-colors"
                style={{ minHeight: '48px' }}
              >
                Skip
              </button>

              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <button
                    onClick={previousStep}
                    className="p-2 rounded-lg bg-atlas-button hover:bg-atlas-button-hover transition-colors"
                    aria-label="Previous step"
                    style={{ minWidth: '48px', minHeight: '48px' }}
                  >
                    <ChevronLeft className="w-5 h-5 text-atlas-text-medium" />
                  </button>
                )}

                {isLastStep ? (
                  <button
                    onClick={completeTutorial}
                    className="px-6 py-2 bg-atlas-sage text-white rounded-lg hover:bg-atlas-success transition-colors font-medium active:scale-[0.98]"
                    style={{ minHeight: '48px' }}
                  >
                    Get Started
                  </button>
                ) : (
                  <button
                    onClick={nextStep}
                    className="px-6 py-2 bg-atlas-sage text-white rounded-lg hover:bg-atlas-success transition-colors font-medium flex items-center gap-2 active:scale-[0.98]"
                    style={{ minHeight: '48px' }}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

