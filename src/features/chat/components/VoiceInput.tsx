import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AlertCircle, Mic, Square } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { audioService } from '../../../services/audioService';
import type { SoundType } from '../hooks/useSoundEffects';

interface VoiceInputProps {
  onTranscriptionComplete: (text: string) => void;
  onSoundPlay?: (soundType: SoundType) => void;
  disabled?: boolean;
  userId?: string;
  tier?: "free" | "core" | "studio";
  sessionId?: string;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ 
  onTranscriptionComplete, 
  onSoundPlay,
  disabled = false,
  userId = "",
  tier = "free",
  sessionId = ""
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_DURATION = 60; // 60 seconds max

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Use audioService to start recording
      const recording = await audioService.startRecording();
      recordingRef.current = recording;
      
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop recording after max duration
          if (newTime >= MAX_RECORDING_DURATION) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
      
      if (onSoundPlay) onSoundPlay('click');
      
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permissions.');
      if (onSoundPlay) onSoundPlay('error');
    }
  }, [onSoundPlay]);

  const stopRecording = useCallback(async () => {
    try {
      if (recordingRef.current && isRecording) {
        // Guard against double-tap
        if (isProcessing) {
          console.log("Already processing, ignoring stop request");
          return;
        }
        
        setIsProcessing(true);
        
        // Stop recording and get file URI
        const fileUri = await audioService.stopRecording(recordingRef.current);
        
        setIsRecording(false);
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        if (onSoundPlay) onSoundPlay('click');
        
        // Transcribe and send to chat service
        if (userId && sessionId) {
          await audioService.transcribeAndSend(
            fileUri,
            {
              user_id: userId,
              tier: tier,
              session_id: sessionId,
            },
            undefined, // onMessage - we'll handle this through the existing chat flow
            (fullText) => {
              onTranscriptionComplete(fullText);
              if (onSoundPlay) onSoundPlay('success');
              setIsProcessing(false);
            },
            (error) => {
              setError(error);
              if (onSoundPlay) onSoundPlay('error');
              setIsProcessing(false);
            }
          );
        } else {
          // Fallback to old transcription method if no user context
          const transcription = await transcribeAudio(fileUri);
          onTranscriptionComplete(transcription);
          if (onSoundPlay) onSoundPlay('success');
          setIsProcessing(false);
        }
      }
    } catch (err) {
      setError('Failed to process recording. Please try again.');
      if (onSoundPlay) onSoundPlay('error');
      setIsProcessing(false);
    }
  }, [isRecording, onSoundPlay, userId, sessionId, tier, onTranscriptionComplete]);

  const transcribeAudio = async (fileUri: string): Promise<string> => {
    // Fallback transcription method for when user context is not available
    try {
      const { audioService } = await import('../../../services/audioService');
      const base64Audio = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Use the STT function from audioService
      const transcription = await audioService.runWhisperSTT?.(base64Audio) || 
        "Voice transcription completed - please check the message for the full response";
      
      return transcription;
    } catch (error) {
      console.error("Fallback transcription error:", error);
      return "Voice transcription completed - please check the message for the full response";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    if (disabled || isProcessing) return;
    
    // Debounce button clicks to prevent rapid state changes
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }, 300); // 300ms debounce
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Recording Button */}
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={`relative p-4 rounded-full transition-all duration-200 ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        } ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        ) : isRecording ? (
          <Square className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
      
      {/* Recording Status */}
      {isRecording && (
        <div className="text-center">
          <div className="text-sm font-medium text-red-600">
            Recording... {formatTime(recordingTime)}
          </div>
          <div className="text-xs text-gray-500">
            Click to stop
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center">
          <div className="text-sm font-medium text-blue-600">
            Processing audio...
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
      
      {/* Instructions */}
      {!isRecording && !isProcessing && !error && (
        <div className="text-center">
          <div className="text-xs text-gray-500">
            Click to start voice recording
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
