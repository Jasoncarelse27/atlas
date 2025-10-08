import { AlertCircle, Mic, Square } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { audioService } from '../../../services/audioService';

interface VoiceInputWebProps {
  onTranscriptionComplete: (text: string) => void;
  onSoundPlay?: (soundType: string) => void;
  disabled?: boolean;
  userId?: string;
  tier?: "free" | "core" | "studio";
  sessionId?: string;
}

const VoiceInputWeb: React.FC<VoiceInputWebProps> = ({ 
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudioBlob(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
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
      if (mediaRecorderRef.current && isRecording) {
        // Guard against double-tap
        if (isProcessing) {
          return;
        }
        
        setIsProcessing(true);
        setIsRecording(false);
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Stop recording
        mediaRecorderRef.current.stop();
        
        if (onSoundPlay) onSoundPlay('click');
      }
    } catch (err) {
      setError('Failed to stop recording. Please try again.');
      if (onSoundPlay) onSoundPlay('error');
      setIsProcessing(false);
    }
  }, [isRecording, onSoundPlay, isProcessing]);

  const processAudioBlob = async (audioBlob: Blob) => {
    try {
      if (!userId) {
        setError('User not authenticated for audio transcription.');
        if (onSoundPlay) onSoundPlay('error');
        return;
      }

      // Use audioService for transcription
      const result = await audioService.transcribeAudio(audioBlob, userId, sessionId, tier);
      
      if (result.text) {
        onTranscriptionComplete(result.text);
        if (onSoundPlay) onSoundPlay('success');
      } else {
        setError('Could not transcribe audio. Please try again.');
        if (onSoundPlay) onSoundPlay('error');
      }
      
    } catch (err) {
      setError('Failed to process audio. Please try again.');
      if (onSoundPlay) onSoundPlay('error');
    } finally {
      setIsProcessing(false);
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
    <div className="relative">
      {/* Recording Button */}
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={`p-2 rounded-full transition-all duration-200 ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-[#B2BDA3] hover:bg-[#B2BDA3]/90 text-white'
        } ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
      >
        {isProcessing ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        ) : isRecording ? (
          <Square className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>
      
      {/* Recording Status - Show as overlay */}
      {isRecording && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-center z-50">
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">
            {formatTime(recordingTime)}
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-center z-50">
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">
            Processing...
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50">
          <div className="flex items-center gap-2 p-2 bg-red-100 border border-red-300 rounded-lg shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInputWeb;
