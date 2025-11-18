/**
 * Keyboard Shortcuts Hook for Ritual Builder
 * 
 * ✅ PHASE 2: Implemented keyboard shortcuts
 * 
 * Implemented Shortcuts:
 * - Cmd/Ctrl+S: Save ritual
 * - Cmd/Ctrl+Z: Undo
 * - Cmd/Ctrl+Shift+Z: Redo
 * - Cmd/Ctrl+K: Open step library (desktop only)
 * - Escape: Close bottom sheet/panels
 * - Arrow keys: Navigate between steps (already implemented)
 * 
 * Usage:
 * ```tsx
 * useRitualBuilderShortcuts({
 *   onSave: handleSave,
 *   onUndo: handleUndo,
 *   onRedo: handleRedo,
 *   onOpenLibrary: () => setShowLibrary(true),
 *   onClosePanels: () => setShowMobileConfig(false),
 *   disabled: isInputFocused,
 * });
 * ```
 */

import { useEffect } from 'react';

interface UseRitualBuilderShortcutsOptions {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenLibrary?: () => void;
  onClosePanels?: () => void;
  disabled?: boolean;
  isMobile?: boolean;
}

export function useRitualBuilderShortcuts({
  onSave,
  onUndo,
  onRedo,
  onOpenLibrary,
  onClosePanels,
  disabled = false,
  isMobile = false,
}: UseRitualBuilderShortcutsOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Escape to work even in inputs
        if (e.key === 'Escape') {
          onClosePanels?.();
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl+S: Save ritual
      if (modKey && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Cmd/Ctrl+Z: Undo
      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Cmd/Ctrl+Shift+Z: Redo
      if (modKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Cmd/Ctrl+K: Open step library (desktop only)
      if (modKey && e.key === 'k' && !isMobile) {
        e.preventDefault();
        onOpenLibrary?.();
        return;
      }

      // Escape: Close bottom sheet/panels
      if (e.key === 'Escape') {
        onClosePanels?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onUndo, onRedo, onOpenLibrary, onClosePanels, disabled, isMobile]);
}

