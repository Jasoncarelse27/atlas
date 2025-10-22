// 🎙️ Voice Call Modal - Studio Tier Exclusive Feature
// Real-time voice conversation with Atlas AI

import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Volume2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { tierFeatures } from '../../config/featureAccess';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import { useFeatureAccess } from '../../hooks/useTierAccess';
import { logger } from '../../lib/logger';
import { voiceCallService } from '../../services/voiceCallService';
import { getSafeUserMedia, isAudioRecordingSupported } from '../../utils/audioHelpers';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  conversationId: string;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  isOpen,
  onClose,
  userId,
  conversationId,
}) => {
  const { canUse, tier } = useFeatureAccess('voice');
  const { showVoiceUpgrade } = useUpgradeModals();
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false); // 🎙️ ChatGPT-style push-to-talk
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Track space key
  const [callDuration, setCallDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [callStatus, setCallStatus] = useState<'listening' | 'transcribing' | 'thinking' | 'speaking'>('listening');
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [lastAIResponse, setLastAIResponse] = useState<string>('');
  const [micLevel, setMicLevel] = useState(0); // 0-100 for visual feedback
  
  const callStartTime = useRef<Date | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const stream = useRef<MediaStream | null>(null);

  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!analyser.current) return;
    
    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = average / 255; // 0-1
    setAudioLevel(normalizedLevel);
    
    // Set mic level for visual indicator (0-100)
    setMicLevel(Math.round(normalizedLevel * 100));
    
    if (isCallActive) {
      requestAnimationFrame(monitorAudioLevel);
    }
  }, [isCallActive]);

  // Start voice call
  const startCall = async () => {
    try {
      // Check tier access using centralized hook
      if (!canUse) {
        onClose();
        showVoiceUpgrade();
        return;
      }

      // Get max duration (-1 = unlimited for Studio)
      const maxDuration = (tierFeatures[tier] as any).voiceCallMaxDuration;
      logger.debug('[VoiceCall] Max duration:', maxDuration);

      setIsCallActive(true);
      callStartTime.current = new Date();
      
      // Start duration timer
      durationInterval.current = setInterval(() => {
        if (callStartTime.current) {
          const seconds = Math.floor((Date.now() - callStartTime.current.getTime()) / 1000);
          setCallDuration(seconds);
        }
      }, 1000);

      // Initialize audio monitoring with iOS compatibility
      try {
        // Check if audio recording is supported
        if (!isAudioRecordingSupported()) {
          throw new Error('Audio recording not supported in this browser');
        }
        
        // Check for HTTPS on mobile (required for microphone access)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isHTTPS = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isMobile && !isHTTPS && !isLocalhost) {
          throw new Error('Voice calls require HTTPS on mobile devices. Please use a secure connection.');
        }
        
        audioContext.current = new AudioContext();
        stream.current = await getSafeUserMedia({ audio: true });
        
        microphone.current = audioContext.current.createMediaStreamSource(stream.current);
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 256;
        
        microphone.current.connect(analyser.current);
        monitorAudioLevel();
      } catch (audioError) {
        logger.error('[VoiceCall] Audio setup failed:', audioError);
        toast.error('Microphone access denied');
        setIsCallActive(false);
        return;
      }

      // Start voice call service
      try {
        await voiceCallService.startCall({
          userId,
          conversationId,
          tier: tier as 'studio',
          onTranscript: (text: string) => {
            logger.debug('[VoiceCall] User said:', text);
            setLastTranscript(text);
          },
          onAIResponse: (text: string) => {
            logger.debug('[VoiceCall] Atlas said:', text);
            setLastAIResponse(text);
          },
          onError: (error: Error) => {
            logger.error('[VoiceCall] Service error:', error);
            const friendlyMessage = error.message.includes('Microphone')
              ? 'Microphone not available'
              : error.message.includes('Connection lost')
              ? 'Connection lost, retrying...'
              : error.message;
            toast.error(friendlyMessage);
            endCall();
          },
          onStatusChange: (status) => {
            setCallStatus(status);
          },
          onAudioLevel: (level: number) => {
            // ✅ CHATGPT-STYLE: Real-time audio level from VAD
            setAudioLevel(level);
            setMicLevel(Math.round(level * 100));
          },
        });
        
        toast.success('Voice call started!');
      } catch (serviceError) {
        logger.error('[VoiceCall] Service failed to start:', serviceError);
        // Continue with UI active even if backend fails (graceful degradation)
        toast('Voice call active (backend unavailable)', { icon: '⚠️' });
      }
    } catch (error) {
      logger.error('[VoiceCall] Failed to start:', error);
      toast.error('Failed to start voice call');
      setIsCallActive(false);
    }
  };

  // End voice call
  const endCall = async () => {
    try {
      await voiceCallService.stopCall(userId);
    } catch (error) {
      logger.error('[VoiceCall] Failed to stop service:', error);
      // Continue cleanup anyway
    }
    
    // Cleanup audio
    if (stream.current) {
      stream.current.getTracks().forEach(track => track.stop());
      stream.current = null;
    }
    if (audioContext.current && audioContext.current.state !== 'closed') {
      await audioContext.current.close();
      audioContext.current = null;
    }
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    
    setIsCallActive(false);
    setCallDuration(0);
    callStartTime.current = null;
    
    toast.success('Voice call ended');
    onClose();
  };

  // Toggle mute
  const toggleMute = () => {
    if (stream.current) {
      const audioTrack = stream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup without triggering endCall (causes React warnings)
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close().catch(err => 
          logger.error('[VoiceCall] Cleanup error:', err)
        );
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  // 🎙️ ChatGPT-Style Push-to-Talk Mode
  const togglePushToTalk = () => {
    setIsPushToTalk(!isPushToTalk);
    if (!isPushToTalk) {
      toast.success('Push-to-talk enabled! Hold Space to speak', { duration: 2000 });
      // Mute immediately when enabling PTT
      if (stream.current && !isMuted) {
        const audioTrack = stream.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          setIsMuted(true);
        }
      }
    } else {
      toast.success('Push-to-talk disabled', { duration: 2000 });
      // Unmute when disabling PTT
      if (stream.current && isMuted) {
        const audioTrack = stream.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          setIsMuted(false);
        }
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      // Space = toggle mute OR push-to-talk
      if (e.code === 'Space' && isCallActive && !e.repeat) {
        e.preventDefault();
        
        if (isPushToTalk) {
          // Push-to-talk: Space down = unmute
          if (!isSpacePressed) {
            setIsSpacePressed(true);
            if (stream.current) {
              const audioTrack = stream.current.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = true;
                setIsMuted(false);
              }
            }
          }
        } else {
          // Normal mode: Space = toggle mute
          toggleMute();
        }
      }
      // Escape = end call or close modal
      if (e.code === 'Escape') {
        e.preventDefault();
        if (isCallActive) {
          endCall();
        } else {
          onClose();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Space up = mute in push-to-talk mode
      if (e.code === 'Space' && isCallActive && isPushToTalk) {
        e.preventDefault();
        setIsSpacePressed(false);
        if (stream.current) {
          const audioTrack = stream.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
            setIsMuted(true);
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, isCallActive, isPushToTalk, isSpacePressed]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isCallActive) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Voice Call</h2>
            <button
              onClick={isCallActive ? endCall : onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Call Status */}
          <div className="text-center mb-8">
            {isCallActive ? (
              <>
                <div className="relative inline-flex items-center justify-center mb-4">
                  {/* Audio level visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={`w-32 h-32 rounded-full transition-all ${
                        callStatus === 'speaking' ? 'bg-emerald-500/30' :
                        callStatus === 'thinking' ? 'bg-blue-500/30 animate-pulse' :
                        callStatus === 'transcribing' ? 'bg-purple-500/30 animate-pulse' :
                        'bg-emerald-500/20'
                      }`}
                      style={{
                        transform: callStatus === 'listening' ? `scale(${1 + audioLevel * 0.5})` : 'scale(1.1)',
                      }}
                    />
                  </div>
                  <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                    callStatus === 'speaking' ? 'bg-emerald-500' :
                    callStatus === 'thinking' ? 'bg-blue-500' :
                    callStatus === 'transcribing' ? 'bg-purple-500' :
                    'bg-emerald-500'
                  }`}>
                    <Phone className="w-12 h-12 text-white" />
                  </div>
                </div>
                <p className={`text-lg font-medium mb-2 transition-colors ${
                  callStatus === 'speaking' ? 'text-emerald-400' :
                  callStatus === 'thinking' ? 'text-blue-400' :
                  callStatus === 'transcribing' ? 'text-purple-400' :
                  'text-emerald-400'
                }`}>
                  {callStatus === 'listening' ? 'Listening...' :
                   callStatus === 'transcribing' ? 'Transcribing...' :
                   callStatus === 'thinking' ? 'Atlas is thinking...' :
                   'Speaking...'}
                </p>
                <p className="text-gray-400 text-3xl font-mono">{formatDuration(callDuration)}</p>
                {(tierFeatures[tier] as any).voiceCallMaxDuration === -1 && (
                  <p className="text-gray-500 text-sm mt-2">Unlimited</p>
                )}
                
                {/* Microphone Level Indicator - ChatGPT Style */}
                {callStatus === 'listening' && (
                  <div className="mt-4 w-full max-w-xs mx-auto">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-gray-400 text-xs">Mic Level:</p>
                      <p className={`text-xs font-medium ${
                        micLevel > 30 ? 'text-emerald-400' : 
                        micLevel > 10 ? 'text-yellow-400' : 
                        'text-gray-500'
                      }`}>
                        {micLevel}%
                      </p>
                    </div>
                    <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-100 ${
                          micLevel > 30 ? 'bg-emerald-500' :
                          micLevel > 10 ? 'bg-yellow-500' :
                          'bg-gray-600'
                        }`}
                        style={{ width: `${micLevel}%` }}
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-1 text-center">
                      {micLevel < 10 ? '🤫 Speak to be heard' : 
                       micLevel < 30 ? '🎤 Speaking...' : 
                       '✅ Clear audio!'}
                    </p>
                    {isPushToTalk && (
                      <p className="text-blue-400 text-xs mt-1 text-center flex items-center justify-center gap-1">
                        {isSpacePressed ? '🎤 Recording...' : '⏸️ Hold Space to speak'}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-gray-400 text-lg">Ready to start voice call</p>
                <p className="text-gray-500 text-sm mt-2">Studio tier exclusive feature</p>
              </>
            )}
          </div>

          {/* Transcript Display */}
          {isCallActive && (lastTranscript || lastAIResponse) && (
            <div className="mb-6 space-y-3 max-h-32 overflow-y-auto">
              {lastTranscript && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-blue-300 text-xs font-medium mb-1">You said:</p>
                  <p className="text-gray-200 text-sm">{lastTranscript}</p>
                </div>
              )}
              {lastAIResponse && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-emerald-300 text-xs font-medium mb-1">Atlas:</p>
                  <p className="text-gray-200 text-sm">{lastAIResponse}</p>
                </div>
              )}
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-4">
            {isCallActive ? (
              <>
                {/* Mute Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMute}
                  disabled={isPushToTalk}
                  className={`p-4 rounded-full transition-colors ${
                    isMuted
                      ? 'bg-red-500 hover:bg-red-600'
                      : isPushToTalk
                      ? 'bg-gray-800 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={isPushToTalk ? 'Disabled in push-to-talk mode' : (isMuted ? 'Unmute' : 'Mute')}
                >
                  {isMuted ? (
                    <MicOff className="w-6 h-6 text-white" />
                  ) : (
                    <Mic className="w-6 h-6 text-white" />
                  )}
                </motion.button>

                {/* End Call Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                >
                  <PhoneOff className="w-8 h-8 text-white" />
                </motion.button>

                {/* Push-to-Talk Toggle - ChatGPT Style */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePushToTalk}
                  className={`p-4 rounded-full transition-colors ${
                    isPushToTalk
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={isPushToTalk ? 'Disable push-to-talk' : 'Enable push-to-talk'}
                >
                  <Volume2 className={`w-6 h-6 ${isPushToTalk ? 'text-white' : 'text-gray-400'}`} />
                </motion.button>
              </>
            ) : (
              /* Start Call Button */
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startCall}
                disabled={tier !== 'studio'}
                className={`px-8 py-4 rounded-full font-medium transition-colors ${
                  tier === 'studio'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {tier === 'studio' ? 'Start Voice Call' : 'Studio Tier Required'}
              </motion.button>
            )}
          </div>

          {/* Features Info */}
          {!isCallActive && (
            <div className="mt-8 p-4 bg-gray-800/50 rounded-xl">
              <p className="text-gray-300 text-sm mb-2">🎙️ Atlas Voice Features:</p>
              <ul className="text-gray-400 text-xs space-y-1">
                <li>• Real-time voice conversation</li>
                <li>• Instant response when you stop speaking</li>
                <li>• Push-to-talk mode (hold Space to speak)</li>
                <li>• Live audio level visualization</li>
                <li>• Unlimited duration (Studio tier)</li>
              </ul>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          {isCallActive && (
            <div className="mt-6 p-3 bg-gray-800/30 rounded-xl">
              <p className="text-gray-400 text-xs text-center">
                {isPushToTalk ? (
                  <>
                    <span className="inline-block px-2 py-0.5 bg-blue-600/50 rounded mr-1">Hold Space</span> Speak • 
                    <span className="inline-block px-2 py-0.5 bg-gray-700/50 rounded mx-1">Esc</span> End Call
                  </>
                ) : (
                  <>
                    <span className="inline-block px-2 py-0.5 bg-gray-700/50 rounded mr-1">Space</span> Mute • 
                    <span className="inline-block px-2 py-0.5 bg-gray-700/50 rounded mx-1">Esc</span> End Call
                  </>
                )}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
