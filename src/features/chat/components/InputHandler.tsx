import { AlertCircle, Mic, Send } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

interface InputHandlerProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  onVoiceTranscription: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const InputHandler: React.FC<InputHandlerProps> = ({
  inputText,
  setInputText,
  onSend,
  onVoiceTranscription,
  disabled = false,
  placeholder = "Type your message...",
  className = ""
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = inputText.trim().length > 0;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

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
          setInputText(transcription);
          onVoiceTranscription(transcription);
        } catch (_err) {
          setError('Failed to transcribe audio. Please try again.');
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
      
    } catch (_err) {
      setError('Microphone access denied. Please allow microphone permissions.');
    }
  }, [onVoiceTranscription, setInputText]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    // Transcription service will be implemented
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

  const handleVoiceClick = () => {
    if (disabled || isProcessing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = () => {
    if (hasText && !disabled) {
      onSend();
    }
  };

  return (
    <div className={`p-4 border-t border-gray-200 ${className}`}>
      <div className="flex gap-3">
        {/* Input Field */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-atlas-sage focus:border-transparent max-h-32 overflow-y-auto"
            rows={1}
            disabled={disabled}
            style={{ minHeight: '44px', maxHeight: '128px' }}
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-2">
          {hasText ? (
            <button
              onClick={handleSend}
              disabled={disabled}
              className="w-10 h-10 bg-atlas-sage text-white rounded-full hover:bg-atlas-success disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center flex-shrink-0"
              aria-label="Send message"
            >
              {disabled ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              onClick={handleVoiceClick}
              disabled={disabled || isProcessing}
              className={`relative w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : 'bg-atlas-sage hover:bg-atlas-success text-white'
              } ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : isRecording ? (
                <div className="w-4 h-4 bg-white rounded-sm"></div>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Voice Recording Status */}
      {isRecording && (
        <div className="mt-2 text-center">
          <div className="text-sm font-medium text-red-600">
            Recording... {formatTime(recordingTime)}
          </div>
          <div className="text-xs text-gray-500">
            Click to stop
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="mt-2 text-center">
          <div className="text-sm font-medium text-atlas-sage">
            Processing audio...
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
      
      {/* Instructions */}
      {!isRecording && !isProcessing && !error && !hasText && (
        <div className="mt-2 text-center">
          <div className="text-xs text-gray-500">
            Type a message or click the mic to record voice
          </div>
        </div>
      )}
    </div>
  );
};

export default InputHandler;
