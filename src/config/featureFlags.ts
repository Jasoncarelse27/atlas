/**
 * Feature Flags Configuration
 * Controls gradual rollout of new features
 */

export const FEATURE_FLAGS = {
  VOICE_STREAMING: import.meta.env.VITE_VOICE_STREAMING_ENABLED === 'true',
  VOICE_V2: import.meta.env.VITE_VOICE_V2_ENABLED === 'true', // ✅ V2 WebSocket streaming
  VOICE_SIMPLIFIED: import.meta.env.VITE_VOICE_SIMPLIFIED === 'true', // ✅ Use simplified voice service
  USE_NETWORK_MONITORING_SERVICE: import.meta.env.VITE_USE_NETWORK_MONITORING_SERVICE === 'true', // ✅ Use extracted NetworkMonitoringService
  USE_RETRY_SERVICE: import.meta.env.VITE_USE_RETRY_SERVICE === 'true', // ✅ Use extracted RetryService
  USE_MESSAGE_PERSISTENCE_SERVICE: import.meta.env.VITE_USE_MESSAGE_PERSISTENCE_SERVICE === 'true', // ✅ Use extracted MessagePersistenceService
  USE_AUDIO_PLAYBACK_SERVICE: import.meta.env.VITE_USE_AUDIO_PLAYBACK_SERVICE === 'true', // ✅ Use extracted AudioPlaybackService
  USE_VAD_SERVICE: import.meta.env.VITE_USE_VAD_SERVICE === 'true', // ✅ Use extracted VADService
  USE_STT_SERVICE: import.meta.env.VITE_USE_STT_SERVICE === 'true', // ✅ Use extracted STTService
  USE_TTS_SERVICE: import.meta.env.VITE_USE_TTS_SERVICE === 'true', // ✅ Use extracted TTSService
  USE_CALL_LIFECYCLE_SERVICE: import.meta.env.VITE_USE_CALL_LIFECYCLE_SERVICE === 'true', // ✅ Use extracted CallLifecycleService
  USE_TIMEOUT_MANAGEMENT_SERVICE: import.meta.env.VITE_USE_TIMEOUT_MANAGEMENT_SERVICE === 'true', // ✅ Use extracted TimeoutManagementService
};

export const isFeatureEnabled = (flag: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[flag];
};

