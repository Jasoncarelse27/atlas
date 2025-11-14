/**
 * Focus Trap Hook
 * Lightweight focus trap for modals/overlays (WCAG 2.4.3)
 * No dependencies - uses native DOM APIs
 */

import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  isActive: boolean;
  containerRef: React.RefObject<HTMLElement>;
  initialFocusRef?: React.RefObject<HTMLElement>;
  restoreFocus?: boolean;
}

export function useFocusTrap({
  isActive,
  containerRef,
  initialFocusRef,
  restoreFocus = true,
}: UseFocusTrapOptions) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Store previous focus element for restoration
    if (restoreFocus) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }

    // Get all focusable elements within container
    const getFocusableElements = (): HTMLElement[] => {
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => {
          // Filter out hidden elements
          const style = window.getComputedStyle(el);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !el.hasAttribute('inert')
          );
        }
      );
    };

    // Focus first element or initial focus ref
    const focusFirstElement = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    };

    // Handle Tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // If Shift+Tab on first element, move to last
      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
        return;
      }

      // If Tab on last element, move to first
      if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
        return;
      }
    };

    // Initial focus
    focusFirstElement();

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus if requested
      if (restoreFocus && previousActiveElementRef.current) {
        // Small delay to ensure modal is fully closed
        setTimeout(() => {
          if (previousActiveElementRef.current) {
            previousActiveElementRef.current.focus();
          }
        }, 100);
      }
    };
  }, [isActive, containerRef, initialFocusRef, restoreFocus]);
}

