import { AlertCircle, Mic, Square } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import type { SoundType } from '../hooks/useSoundEffects';

interface VoiceInputProps {
  onTranscriptionComplete: (text: string) => void;
  onSoundPlay?: (soundType: SoundType) => void;
  disabled?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ 
  onTranscriptionComplete, 
  onSoundPlay,
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const transcription = await transcribeAudio(audioBlob);
          onTranscriptionComplete(transcription);
          if (onSoundPlay) onSoundPlay('success');
        } catch (_err) {
          setError('Failed to transcribe audio. Please try again.');
          if (onSoundPlay) onSoundPlay('error');
        } finally {
          setIsProcessing(false);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      if (onSoundPlay) onSoundPlay('click');
      
    } catch (_err) {
      setError('Microphone access denied. Please allow microphone permissions.');
      if (onSoundPlay) onSoundPlay('error');
    }
  }, [onTranscriptionComplete, onSoundPlay]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (onSoundPlay) onSoundPlay('click');
    }
  }, [isRecording, onSoundPlay]);

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    // TODO: Implement actual transcription service
    // For now, return a placeholder
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("Voice transcription placeholder - implement with actual service");
      }, 1000);
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    if (disabled || isProcessing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
