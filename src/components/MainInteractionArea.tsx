import React, { useEffect, useRef } from 'react';
import type { SoundType } from '../hooks/useSoundEffects';
import { useFeatureAccess } from '../hooks/useTierAccess';
import EnhancedResponseArea from './EnhancedResponseArea';
import ImageInputArea from './ImageInputArea';
import TextInputArea from './TextInputArea';
import VoiceInputArea from './VoiceInputArea';

interface MainInteractionAreaProps {
  mode: 'text' | 'voice' | 'image';
  isProcessing: boolean;
  response: string;
  audioUrl: string | null;
  imageAnalysisResult?: { description: string; confidence?: number; labels?: string[] };
  transcript: string;
  isListening: boolean;
  voices?: SpeechSynthesisVoice[];
  currentVoice?: SpeechSynthesisVoice | null;
  isMuted: boolean;
  onVoiceStart: () => void;
  onVoiceEnd: () => void;
  onTextInput: (message: string) => void;
  onImageSelect: (file: File) => void;
  onVoiceChange?: (voice: SpeechSynthesisVoice) => void;
  onMuteToggle: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
  browserSupportsSpeechRecognition?: boolean;
  connectionStatus?: 'online' | 'offline' | 'connecting';
  onShowVoiceSettings?: () => void;
}

const MainInteractionArea: React.FC<MainInteractionAreaProps> = ({
  mode,
  isProcessing,
  response,
  audioUrl,
  imageAnalysisResult,
  transcript,
  isListening,
  voices = [],
  currentVoice = null,
  isMuted,
  onVoiceStart,
  onVoiceEnd,
  onTextInput,
  onImageSelect,
  onVoiceChange,
  onMuteToggle,
  onSoundPlay,
  browserSupportsSpeechRecognition = true,
  connectionStatus = 'online',
  onShowVoiceSettings
}) => {
  // Create refs for each input area
  const textInputAreaRef = useRef<HTMLDivElement>(null);
  const voiceInputAreaRef = useRef<HTMLDivElement>(null);
  const imageInputAreaRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // 🎯 TIER ENFORCEMENT: Add feature access checks
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio');
  const { canUse: canUseImage, attemptFeature: attemptImage } = useFeatureAccess('image');

  // Effect to scroll to and focus the appropriate input area when mode changes
  useEffect(() => {
    // Wait a moment for the UI to update before scrolling
    setTimeout(() => {
      if (mode === 'text' && textInputAreaRef.current) {
        textInputAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (mode === 'voice' && voiceInputAreaRef.current) {
        voiceInputAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (mode === 'image' && imageInputAreaRef.current) {
        imageInputAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }, [mode]);

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 pt-4 relative text-white main">
      <div className="space-y-6">
        {/* Response Area */}
        <EnhancedResponseArea
          response={response}
          isLoading={isProcessing}
          mode={mode}
          connectionStatus={connectionStatus}
          transcript={transcript}
          isListening={isListening}
          audioUrl={audioUrl}
          onSoundPlay={onSoundPlay}
          onShowVoiceSettings={onShowVoiceSettings}
          connectionStatus={connectionStatus}
          ref={responseRef}
        />

        {/* Current Mode Input Area */}
        {mode === 'text' && (
          <TextInputArea
            ref={textInputAreaRef}
            onSendMessage={onTextInput}
            isProcessing={isProcessing}
            onSoundPlay={onSoundPlay}
          />
        )}
        
        {mode === 'voice' && (
          <div className="h-[calc(100vh-300px)] min-h-[400px] relative">
            <VoiceInputArea 
              ref={voiceInputAreaRef}
              isListening={isListening}
              isProcessing={isProcessing}
              isMuted={isMuted}
              connectionStatus={connectionStatus}
              transcript={transcript}
              onMuteToggle={onMuteToggle}
              onPressStart={canUseAudio ? onVoiceStart : attemptAudio}
              onPressEnd={onVoiceEnd}
              onShowVoiceSettings={onShowVoiceSettings}
              hasPermission={browserSupportsSpeechRecognition && canUseAudio}
              onSoundPlay={onSoundPlay}
              disabled={!canUseAudio}
            />
          </div>
        )}
        
        {mode === 'image' && (
          <ImageInputArea 
            ref={imageInputAreaRef}
            onImageSelect={canUseImage ? onImageSelect : attemptImage}
            isProcessing={isProcessing}
            onSoundPlay={onSoundPlay}
            disabled={!canUseImage}
          />
        )}
      </div>
    </div>
  );
};

export default MainInteractionArea;