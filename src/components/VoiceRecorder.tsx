import React from "react";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { voiceService } from '../services/voiceService';

interface VoiceRecorderProps {
  onTranscriptReady: (transcript: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  isVisible: boolean;
}

interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  isProcessing: boolean;
}

export function VoiceRecorder({ 
  onTranscriptReady, 
  onError, 
  onCancel, 
  isVisible 
}: VoiceRecorderProps) {
  const { isOnline } = useNetworkStatus();
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    isProcessing: false,
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      if (!isOnline) {
        onError('Voice recording requires an internet connection');
        return;
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordingState(prev => ({ ...prev, audioBlob, isProcessing: true }));

        try {
          // Upload and transcribe
          const transcript = await voiceService.recordAndTranscribe(audioBlob);
          onTranscriptReady(transcript);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Failed to transcribe audio');
        } finally {
          setRecordingState(prev => ({ ...prev, isProcessing: false }));
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        audioBlob: null 
      }));

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        onError('Microphone permission denied. Please allow microphone access.');
      } else {
        onError('Failed to start recording. Please try again.');
      }
    }
  }, [isOnline, onError, onTranscriptReady]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
      setRecordingState(prev => ({ ...prev, isRecording: false }));
      
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [recordingState.isRecording]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (recordingState.isRecording) {
      stopRecording();
    }
    onCancel();
  }, [recordingState.isRecording, stopRecording, onCancel]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="text-center">
          {/* Header */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Voice Recording
          </h3>

          {/* Recording Status */}
          {recordingState.isRecording ? (
            <div className="space-y-4">
              {/* Recording Animation */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-8 h-8 bg-white rounded-full"></div>
                </div>
              </div>
              
              {/* Duration */}
              <div className="text-2xl font-mono text-gray-700">
                {formatDuration(recordingState.duration)}
              </div>
              
              {/* Status Text */}
              <p className="text-gray-600">Recording... Tap to stop</p>
              
              {/* Stop Button */}
              <button
                onClick={stopRecording}
                className="w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
              >
                Stop Recording
              </button>
            </div>
          ) : recordingState.isProcessing ? (
            <div className="space-y-4">
              {/* Processing Animation */}
              <div className="flex justify-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              
              <p className="text-gray-600">Processing audio...</p>
              <p className="text-sm text-gray-500">This may take a few seconds</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mic Icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
              
              <p className="text-gray-600">Tap to start recording</p>
              
              {/* Start Button */}
              <button
                onClick={startRecording}
                disabled={!isOnline}
                className={`w-full py-3 px-6 rounded-lg transition-colors ${
                  isOnline 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isOnline ? 'Start Recording' : 'Offline - Unavailable'}
              </button>
            </div>
          )}

          {/* Cancel Button */}
          <button
            onClick={cancelRecording}
            className="mt-4 text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
