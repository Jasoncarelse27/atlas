import React, { forwardRef, useEffect, useState } from 'react';
import { Volume2, VolumeX, Settings, Zap } from 'lucide-react';
import VoiceVisualizer from './VoiceVisualizer';
import Tooltip from '@/components/Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';
import ConversationModeButton from './ConversationModeButton';

interface VoiceInputAreaProps {
  isListening: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  transcript: string;
  onMuteToggle: () => void;
  onPressStart: () => void;
  onPressEnd: () => void;
  isRetrying?: boolean;
  hasPermission?: boolean;
  onSoundPlay?: (soundType: SoundType) => void;
  isConversationMode?: boolean;
  connectionStatus?: 'online' | 'offline' | 'connecting';
  onShowVoiceSettings?: () => void;
  onToggleConversationMode?: () => void;
  isAwaitingSpeechEnd?: boolean;
  silenceTimer?: number;
}

const VoiceInputArea = forwardRef<HTMLDivElement, VoiceInputAreaProps>(({
  isListening,
  isProcessing,
  isMuted,
  transcript,
  onMuteToggle,
  onPressStart,
  onPressEnd,
  isRetrying = false,
  hasPermission = true,
  onSoundPlay,
  connectionStatus = 'online',
  onShowVoiceSettings,
  isConversationMode = false,
  onToggleConversationMode,
  isAwaitingSpeechEnd = false,
  silenceTimer = 0
}, ref) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceQuality, setShowVoiceQuality] = useState(false);
  const [voiceQuality, setVoiceQuality] = useState<'standard' | 'high' | 'ultra'>('high');
  
  // Simulate audio level changes when listening
  useEffect(() => {
    if (!isListening || isMuted) {
      setAudioLevel(0);
      return;
    }
    
    const interval = setInterval(() => {
      // Random audio level between 0.2 and 0.8
      setAudioLevel(0.2 + Math.random() * 0.6);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isListening, isMuted]);

  // Auto-scroll into view when component mounts
  useEffect(() => {
    if (ref && 'current' in ref && ref.current && !isProcessing) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [ref, isProcessing]);

  const handleVoiceQualityChange = (quality: 'standard' | 'high' | 'ultra') => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    setVoiceQuality(quality);
    setShowVoiceQuality(false);
  };

  const handleToggleSettings = () => {
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    
    setShowSettings(!showSettings);
  };

  const handleToggleVoiceQuality = () => {
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    
    setShowVoiceQuality(!showVoiceQuality);
  };

  const handleMuteToggle = () => {
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    
    onMuteToggle();
  };

  const handleToggleConversationMode = () => {
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    
    if (onToggleConversationMode) {
      onToggleConversationMode();
    }
  };

  const handleConversationModeStart = () => {
    if (onSoundPlay) {
      onSoundPlay('start_listening');
    }
    
    if (!isListening && !isProcessing) {
      onPressStart();
    }
  };

  const handleConversationModeStop = () => {
    if (onSoundPlay) {
      onSoundPlay('stop_listening');
    }
    
    if (isListening) {
      onPressEnd();
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center relative voice-input-area min-h-[400px]" ref={ref} style={{zIndex: 40}}>
      {/* Dark Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 opacity-95 rounded-3xl z-0"></div>
      
      {/* Main Content Area */}
      <div className="w-full flex flex-col items-center justify-center h-full py-8 relative z-10">
        {/* Transcript Display / Start Talking Message */}
        <div className="w-full flex items-center justify-center mb-8">
          <div className="text-center">
            {transcript ? (
              <p className="text-white text-center text-3xl font-medium">
                {transcript}
              </p>
            ) : (
              <h2 className="text-white text-4xl font-bold">
                {isAwaitingSpeechEnd ? 'Processing...' :
                 isListening ? 'Listening...' : 
                 isProcessing ? 'Processing...' : 
                 'Tap to speak'}
              </h2>
            )}
          </div>
        </div>
        
        {/* Voice Visualizer */}
        <div className="mb-8">
          <VoiceVisualizer
            isListening={isListening}
            isProcessing={isProcessing}
            isMuted={isMuted}
            audioLevel={audioLevel}
            enhanced={true}
          />
        </div>
        
        {/* Connection Status */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-800/60 rounded-full">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'online' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            } ${isListening ? 'animate-pulse' : ''}`}></div>
            <span className="text-gray-300 text-sm">
              {isListening ? 'Listening...' : 
               isProcessing ? 'Processing...' : 
               'Ready'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Full-screen clickable area to start/stop listening */}
      <div
        className={`absolute inset-0 cursor-pointer rounded-3xl ${isListening ? 'bg-blue-500/10' : ''}`}
        style={{zIndex: 20}}
        onMouseDown={!isProcessing && !isMuted && hasPermission ? onPressStart : undefined}
        onMouseUp={isListening ? onPressEnd : undefined}
        onMouseLeave={isListening ? onPressEnd : undefined}
        onTouchStart={!isProcessing && !isMuted && hasPermission ? onPressStart : undefined}
        onTouchEnd={isListening ? onPressEnd : undefined}
      />
      
      {/* Settings Panel */}
      {showSettings && (
        <div></div>
      )}
    </div>
  );
});

VoiceInputArea.displayName = 'VoiceInputArea';

export default VoiceInputArea;