/**
 * ✅ PWA INSTALL PROMPT: Professional install banner for mobile users
 * 
 * Shows install instructions for iOS and install button for Android
 * Only displays on mobile devices that haven't installed yet
 * 
 * Features:
 * - Analytics tracking (impressions/completions)
 * - Accessibility (aria-live for screen readers)
 * - Desktop support (optional tooltip)
 * - Smooth fade-in animation
 */

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const { isMobile, isPWA, canInstall } = useMobileOptimization();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  // ✅ ANALYTICS: Track PWA install prompt impressions
  const trackPWAEvent = async (eventType: 'pwa_install_prompt_shown' | 'pwa_installed' | 'pwa_install_dismissed') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      // ✅ FIX: Skip tracking if user not authenticated (RLS requires user_id)
      if (!userId) {
        logger.debug('[PWAInstallPrompt] Skipping analytics - user not authenticated');
        return;
      }

      await supabase
        .from('usage_logs')
        .insert({
          user_id: userId, // ✅ CRITICAL: Set user_id for RLS compliance
          event: eventType,
          data: {
            platform: isIOS ? 'ios' : 'android',
            is_mobile: isMobile,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString()
        });

      logger.debug(`[PWAInstallPrompt] ✅ Tracked ${eventType} for user ${userId}`);
    } catch (error) {
      // Don't break user flow if analytics fails
      logger.debug(`[PWAInstallPrompt] Analytics tracking failed (non-blocking):`, error);
    }
  };

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isPWA) {
      logger.debug('[PWAInstallPrompt] Already installed as PWA, hiding prompt');
      return;
    }

    // ✅ DESKTOP & MOBILE: Listen for beforeinstallprompt on all devices
    // Desktop browsers (Chrome/Edge) also support PWA install

    // Check if user dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show again after 7 days if dismissed
    if (dismissed && daysSinceDismissed < 7) {
      logger.debug('[PWAInstallPrompt] User dismissed, will show again in 7 days');
      return;
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Android: Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowPrompt(true);
      logger.debug('[PWAInstallPrompt] Android install prompt available');
      
      // ✅ ANALYTICS: Track impression when prompt is shown
      if (!hasTrackedImpression) {
        trackPWAEvent('pwa_install_prompt_shown');
        setHasTrackedImpression(true);
      }
    };

    // iOS: Show instructions after a delay (iOS doesn't have beforeinstallprompt)
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
        logger.debug('[PWAInstallPrompt] Showing iOS install instructions');
        
        // ✅ ANALYTICS: Track impression when prompt is shown
        if (!hasTrackedImpression) {
          trackPWAEvent('pwa_install_prompt_shown');
          setHasTrackedImpression(true);
        }
      }, 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }

    // ✅ DESKTOP & MOBILE: Listen for install prompt on all platforms
    // Chrome/Edge desktop and Android mobile both support beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Desktop: Show prompt after delay (beforeinstallprompt may not fire immediately)
    if (!isMobile && !isIOSDevice) {
      const desktopTimer = setTimeout(() => {
        setShowPrompt(true);
        logger.debug('[PWAInstallPrompt] Desktop - showing install prompt');
        
        // ✅ ANALYTICS: Track impression when prompt is shown
        if (!hasTrackedImpression) {
          trackPWAEvent('pwa_install_prompt_shown');
          setHasTrackedImpression(true);
        }
      }, 5000); // Show after 5 seconds on desktop
      
      return () => {
        clearTimeout(desktopTimer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isMobile, isPWA, hasTrackedImpression]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS - just show instructions (already visible)
      return;
    }

    try {
      // Show install prompt
      await deferredPrompt.prompt();
      
      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        logger.info('[PWAInstallPrompt] ✅ User installed PWA');
        // ✅ ANALYTICS: Track successful installation
        trackPWAEvent('pwa_installed');
        setShowPrompt(false);
        setDeferredPrompt(null);
      } else {
        logger.debug('[PWAInstallPrompt] User dismissed install prompt');
        // ✅ ANALYTICS: Track dismissal
        trackPWAEvent('pwa_install_dismissed');
      }
    } catch (error) {
      logger.error('[PWAInstallPrompt] Install error:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    // ✅ ANALYTICS: Track dismissal
    trackPWAEvent('pwa_install_dismissed');
    logger.debug('[PWAInstallPrompt] User dismissed, will show again in 7 days');
  };

  // ✅ DESKTOP: Show smaller tooltip on desktop browsers that support PWA install
  const isDesktop = !isMobile && canInstall;
  
  if (isPWA) {
    return null;
  }

  // ✅ FIX: Check if user dismissed before showing desktop button
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
  const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
  const isDismissed = dismissed && daysSinceDismissed < 7;

  // Desktop: Show subtle tooltip (only if not dismissed)
  if (isDesktop && !showPrompt && !isDismissed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={() => setShowPrompt(true)}
          className="bg-[#D3DCAB] hover:bg-[#C5D09F] dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-sm font-medium py-2 px-4 rounded-lg shadow-lg transition-colors"
          aria-label="Install Atlas for a full-screen experience"
        >
          Install Atlas
        </button>
      </motion.div>
    );
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-[100] p-3 sm:p-4 bg-gradient-to-b from-[#F9F6F3] dark:from-gray-900 via-[#F9F6F3] dark:via-gray-900 to-transparent"
        style={{
          paddingTop: `max(8px, env(safe-area-inset-top, 8px))`,
        }}
        aria-live="polite"
        role="status"
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#E8DDD2] dark:border-gray-700 p-4 flex items-start gap-3 max-w-full">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-[#A4B494] rounded-xl flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1">
              Install Atlas for the Best Experience
            </h3>
            <div className="text-sm text-gray-600 mb-3">
              <ul className="space-y-1 list-disc list-inside">
                <li>Faster loading</li>
                <li>Offline access</li>
                <li>App-like experience</li>
              </ul>
            </div>

            {/* iOS Instructions */}
            {isIOS && (
              <div className="bg-[#F9F6F3] rounded-lg p-3 mb-3 text-xs text-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">1.</span>
                  <span>Tap the Share button</span>
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">2.</span>
                  <span>Select "Add to Home Screen"</span>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {/* Android/Desktop: Show install button if prompt is available */}
              {!isIOS && deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-[#A4B494] hover:bg-[#93A382] text-white font-medium py-2.5 px-4 rounded-xl transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  View Instructions
                </button>
              )}
              {/* Desktop: Show install button only when beforeinstallprompt is available */}
              {!isMobile && canInstall && deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-[#A4B494] hover:bg-[#93A382] text-white font-medium py-2.5 px-4 rounded-xl transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  View Instructions
                </button>
              )}
              {/* Desktop: Show message if install not yet available */}
              {!isMobile && canInstall && !deferredPrompt && (
                <div className="flex-1 text-sm text-gray-600 py-2.5 px-4 text-center">
                  Install option will appear soon
                </div>
              )}
              {/* iOS: Show "Learn More" button that scrolls to instructions */}
              {isIOS && (
                <button
                  onClick={() => {
                    // iOS instructions are already visible above
                    logger.debug('[PWAInstallPrompt] iOS - instructions already visible');
                  }}
                  className="flex-1 bg-[#A4B494] hover:bg-[#93A382] text-white font-medium py-2.5 px-4 rounded-xl transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  View Instructions
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-xl transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
              >
                Maybe Later
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg transition-colors touch-manipulation"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      </motion.div>
    </AnimatePresence>
  );
}

