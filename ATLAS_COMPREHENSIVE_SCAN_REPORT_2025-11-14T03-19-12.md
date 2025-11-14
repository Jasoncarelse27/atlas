# Atlas Comprehensive Codebase Scan Report

**Date:** 2025-11-14T03:19:12.144Z

---

## Summary

- **Total Issues Found:** 148
- **Code Quality:** 54
- **Best Practices:** 14
- **Security:** 0
- **Performance:** 18
- **Architecture:** 0
- **Database:** 0
- **Mobile/Web:** 62

---

## Code Quality Issues

- **/src/components/chat/AttachmentMenu.tsx** (Line 13): console.log found - should use logger [low]
- **/src/components/chat/EnhancedInputToolbar.tsx** (Line 24): console.log found - should use logger [low]
- **/src/components/sidebar/LiveInsightsWidgets.tsx** (Line 42): console.log found - should use logger [low]
- **/src/components/sidebar/LiveInsightsWidgets.tsx** (Line 48): console.log found - should use logger [low]
- **/src/components/sidebar/LiveInsightsWidgets.tsx** (Line 179): console.log found - should use logger [low]
- **/src/components/sidebar/LiveInsightsWidgets.tsx** (Line 198): console.log found - should use logger [low]
- **/src/components/sidebar/LiveInsightsWidgets.tsx** (Line 208): console.log found - should use logger [low]
- **/src/features/chat/components/TextInputArea.tsx** (Line 208): TODO/FIXME: // TODO: Add voice input handler [info]
- **/src/lib/logger.ts** (Line 12): console.log found - should use logger [low]
- **/src/lib/logger.ts** (Line 17): console.log found - should use logger [low]
- **/src/main.tsx** (Line 21): console.log found - should use logger [low]
- **/src/main.tsx** (Line 30): console.log found - should use logger [low]
- **/src/main.tsx** (Line 31): console.log found - should use logger [low]
- **/src/main.tsx** (Line 32): console.log found - should use logger [low]
- **/src/main.tsx** (Line 33): console.log found - should use logger [low]
- **/src/pages/ChatPage.tsx** (Line 1868): console.log found - should use logger [low]
- **/src/services/offlineMessageStore.ts** (Line 2): TODO/FIXME: // TODO: Implement full offline message storage functionality [info]
- **/src/services/voiceCallService.ts** (Line 559): TODO/FIXME: * TODO: Extract to VADService.startRecording() [info]
- **/src/services/voiceCallService.ts** (Line 820): TODO/FIXME: * TODO: Extract to VADService.calibrate() [info]
- **/src/services/voiceCallService.ts** (Line 887): TODO/FIXME: * TODO: Extract to VADService.startMonitoring() [info]
- **/src/services/voiceCallService.ts** (Line 1272): TODO/FIXME: * TODO: Extract STT/TTS logic to respective services [info]
- **/src/services/voiceCallService.ts** (Line 1301): TODO/FIXME: * TODO: Extract STT/TTS logic to respective services [info]
- **/src/services/voiceCallService.ts** (Line 1519): TODO/FIXME: * TODO: Extract STT/TTS logic to respective services [info]
- **/src/services/voiceCallService.ts** (Line 2195): TODO/FIXME: // TODO: Extract to STTService.encodeAudio() [info]
- **/src/services/voiceCallService.ts** (Line 2275): TODO/FIXME: // TODO: This is part of TTS service in standard mode [info]
- **/src/services/voiceCallService.ts** (Line 2532): TODO/FIXME: * TODO: Extract to TTSService.playAcknowledgment() [info]
- **/src/services/voiceCallService.ts** (Line 2564): TODO/FIXME: * TODO: Extract to NetworkMonitoringService.start() [info]
- **/src/services/voiceCallService.ts** (Line 2596): TODO/FIXME: * TODO: Extract to NetworkMonitoringService.stop() [info]
- **/src/services/voiceCallService.ts** (Line 2610): TODO/FIXME: * TODO: Extract to NetworkMonitoringService.checkQuality() [info]
- **/supabase/functions/fastspring-webhook/index.ts** (Line 112): console.log found - should use logger [low]
- **/supabase/functions/fastspring-webhook/index.ts** (Line 116): console.log found - should use logger [low]
- **/supabase/functions/fastspring-webhook/index.ts** (Line 149): console.log found - should use logger [low]
- **/supabase/functions/fastspring-webhook/index.ts** (Line 180): console.log found - should use logger [low]
- **/supabase/functions/fastspringWebhook/index.ts** (Line 119): console.log found - should use logger [low]
- **/supabase/functions/fastspringWebhook/index.ts** (Line 123): console.log found - should use logger [low]
- **/supabase/functions/fastspringWebhook/index.ts** (Line 135): console.log found - should use logger [low]
- **/supabase/functions/fastspringWebhook/index.ts** (Line 151): console.log found - should use logger [low]
- **/supabase/functions/feature-nudge/index.ts** (Line 16): console.log found - should use logger [low]
- **/supabase/functions/feature-nudge/index.ts** (Line 37): console.log found - should use logger [low]
- **/supabase/functions/feature-nudge/index.ts** (Line 61): console.log found - should use logger [low]
- **/supabase/functions/mailerWebhook/index.ts** (Line 28): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 29): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 71): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 81): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 88): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 121): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 146): console.log found - should use logger [low]
- **/supabase/functions/retryFailedUploads/index.ts** (Line 165): console.log found - should use logger [low]
- **/supabase/functions/stt/index.ts** (Line 113): console.log found - should use logger [low]
- **/supabase/functions/tts/index.ts** (Line 43): console.log found - should use logger [low]
- **/supabase/functions/tts/index.ts** (Line 288): console.log found - should use logger [low]
- **/supabase/supabase-temp-backup/functions/chat/index.ts** (Line 132): console.log found - should use logger [low]
- **/supabase/supabase-temp-backup/functions/mailerWebhook/index.ts** (Line 28): console.log found - should use logger [low]
- **/supabase/supabase-temp-backup/functions/paddle-webhook/index.ts** (Line 22): TODO/FIXME: // TODO: Implement true Paddle signature verification per docs. [info]

## Best Practices Issues

- **/src/components/PWAInstallPrompt.tsx**: localStorage key should use "atlas:" prefix [low]
- **/src/components/WidgetSystem.tsx**: localStorage key should use "atlas:" prefix [low]
- **/src/components/chat/EnhancedInputToolbar.tsx**: localStorage key should use "atlas:" prefix [low]
- **/src/context/SafeModeContext.tsx**: localStorage key should use "atlas:" prefix [low]
- **/src/contexts/TierContext.tsx**: Hardcoded tier check - should use useTierAccess hook [medium]
- **/src/hooks/useCustomization.ts**: localStorage key should use "atlas:" prefix [low]
- **/src/hooks/useLocalStorage.ts**: localStorage key should use "atlas:" prefix [low]
- **/src/hooks/useMessageLimit.ts**: localStorage key should use "atlas:" prefix [low]
- **/src/main.tsx**: localStorage key should use "atlas:" prefix [low]
- **/src/providers/AuthProvider.tsx**: localStorage key should use "atlas:" prefix [low]
- **/src/services/dbMigrations.ts**: localStorage key should use "atlas:" prefix [low]
- **/src/services/voiceCallService.ts**: localStorage key should use "atlas:" prefix [low]
- **/src/stores/useConversations.ts**: localStorage key should use "atlas:" prefix [low]
- **/src/utils/dexieErrorHandler.ts**: localStorage key should use "atlas:" prefix [low]

## Performance Issues

- **/src/components/ControlCenter.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/DashboardTester.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/DashboardTesterSimplified.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/WidgetSystem.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/modals/VoiceCallModal.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/sidebar/EmotionalInsightsWidgets.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/sidebar/QuickActions.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/components/sidebar/UsageCounter.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/features/chat/components/ConversationHistoryPanel.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/features/chat/components/ConversationView.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/features/chat/hooks/useConversationStream.ts**: Consider using useMemo for expensive filter operations [low]
- **/src/features/rituals/components/RitualInsightsDashboard.tsx**: Consider using useMemo for expensive filter operations [low]
- **/src/features/rituals/hooks/useFavoriteRituals.ts**: Consider using useMemo for expensive filter operations [low]
- **/src/features/rituals/hooks/useRitualBuilder.ts**: Consider using useMemo for expensive filter operations [low]
- **/src/hooks/useRealtimeConversations.ts**: Consider using useMemo for expensive filter operations [low]
- **/src/hooks/useSubscription.ts**: Consider using useMemo for expensive filter operations [low]
- **/src/hooks/useSubscriptionConsolidated.ts**: Consider using useMemo for expensive filter operations [low]
- **/src/hooks/useTierQuery.ts**: Consider using useMemo for expensive filter operations [low]

## Mobile/Web Issues

- **/src/components/ConversationHistoryDrawer.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/ConversationHistoryDrawer.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/ConversationHistoryDrawer.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/ConversationHistoryDrawer.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/ConversationHistoryDrawer.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/EnhancedResponseArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/EnhancedResponseArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/EnhancedResponseArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/EnhancedResponseArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/EnhancedResponseArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/EnhancedResponseArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/Header.tsx**: Mobile detection should use useMobileOptimization hook [low]
- **/src/components/PWAInstallPrompt.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/PWAInstallPrompt.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/PWAInstallPrompt.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/PWAInstallPrompt.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/ScrollToBottomButton.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/ScrollToBottomButton.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/AttachmentMenu.tsx**: Mobile detection should use useMobileOptimization hook [low]
- **/src/components/chat/ChatInput.tsx**: Touch target size 40px is below 48px minimum [medium]
- **/src/components/chat/EnhancedInputToolbar.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/chat/EnhancedMessageBubble.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/modals/VoiceCallModal.tsx**: Mobile detection should use useMobileOptimization hook [low]
- **/src/components/modals/VoiceUpgradeModal.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/components/modals/VoiceUpgradeModal.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/chat/components/TextInputArea.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/DataMigrationButton.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Mobile detection should use useMobileOptimization hook [low]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 36px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualBuilder.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualLibrary.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualLibrary.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualLibrary.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualLibrary.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualRunView.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualRunView.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualRunView.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualRunView.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualRunView.tsx**: Touch target size 44px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualStepCard.tsx**: Touch target size 36px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualStepCard.tsx**: Touch target size 36px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualStepCard.tsx**: Touch target size 36px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualStepCard.tsx**: Touch target size 36px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualStepCard.tsx**: Touch target size 36px is below 48px minimum [medium]
- **/src/features/rituals/components/RitualStepCard.tsx**: Touch target size 36px is below 48px minimum [medium]

---

## Conclusion

Found 148 issues across 7 categories.
Review and address issues based on severity (high > medium > low > info).
