import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../lib/logger';

interface UseVoiceRecognitionReturn {
  isListening: boolean;
  transcript: string;
  browserSupportsSpeechRecognition: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  isRetrying: boolean;
  isSupportedBrowser: boolean;
  hasPermission: boolean;
  isConversationMode: boolean;
  toggleConversationMode: () => void;
  isAwaitingSpeechEnd: boolean;
  silenceTimer: number;
}

interface UseVoiceRecognitionProps {
  onSpeechEndDetected?: (transcript: string) => void;
  initialConversationMode?: boolean;
  conversationSilenceThreshold?: number;
}

const useVoiceRecognition = ({
  onSpeechEndDetected,
  initialConversationMode = false,
  conversationSilenceThreshold = 2500
}: UseVoiceRecognitionProps = {}): UseVoiceRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [browserSupportsSpeechRecognition, setBrowserSupportsSpeechRecognition] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(initialConversationMode);
  const [isAwaitingSpeechEnd, setIsAwaitingSpeechEnd] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const isManualStopRef = useRef(false);
  const conversationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef('');
  const silenceStartTimeRef = useRef<number | null>(null);
  const silenceTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTranscriptRef = useRef('');
  
  const maxRetries = 2; // Reduced retries
  const retryDelay = 500; // Reduced delay

  useEffect(() => {
    
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition || 
                             (window as any).mozSpeechRecognition || 
                             (window as any).msSpeechRecognition;
                             
    
    if (!SpeechRecognition) {
      setBrowserSupportsSpeechRecognition(false);
      setError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Configure recognition with better settings
    recognition.continuous = isConversationMode; // Set based on conversation mode
    recognition.interimResults = true; // Show interim results
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    logger.debug({
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      maxAlternatives: recognition.maxAlternatives,
      lang: recognition.lang,
      isConversationMode
    });

    // Check microphone permission
    const checkPermission = async () => {
      try {
        // Try to get user media first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        setError(null);
      } catch (err) {
      // Intentionally empty - error handling not required
        setHasPermission(false);
        setError('Microphone access is required. Please allow microphone access in your browser settings.');
      }
    };

    checkPermission();

    // Event handlers
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setIsRetrying(false);
      setIsAwaitingSpeechEnd(false);
      isManualStopRef.current = false;
      
      // Reset accumulated transcript in conversation mode
      if (isConversationMode) {
        accumulatedTranscriptRef.current = '';
      }
      
      // Reset silence timer
      silenceStartTimeRef.current = null;
      setSilenceTimer(0);
    };

    recognition.onend = () => {
      
      setIsListening(false);

      // Clear silence timer interval
      if (silenceTimerIntervalRef.current) {
        clearInterval(silenceTimerIntervalRef.current);
        silenceTimerIntervalRef.current = null;
      }

      // Handle conversation mode restart
      if (isConversationMode && !isManualStopRef.current && !isAwaitingSpeechEnd) {
        try {
          // Small delay before restarting to allow processing
          setTimeout(() => {
            if (recognitionRef.current && !isManualStopRef.current) {
              recognitionRef.current.start();
            }
          }, 300);
        } catch (err) {
      // Intentionally empty - error handling not required
          setError('Failed to maintain conversation mode. Please try again.');
        }
        return;
      }

      // Only retry if not manually stopped, retrying is enabled, and we haven't exceeded max retries
      if (!isManualStopRef.current && isRetrying && retryCount < maxRetries && hasPermission) {
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          if (recognitionRef.current && !isManualStopRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
      // Intentionally empty - error handling not required
              setError('Failed to restart recognition. Please try again.');
              setIsRetrying(false);
            }
          }
        }, retryDelay);
      } else if (!isManualStopRef.current && !currentTranscriptRef.current.trim() && retryCount < maxRetries && !error && hasPermission) {
        // Original retry logic for no transcript
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          if (recognitionRef.current && !isManualStopRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
      // Intentionally empty - error handling not required
              setError('Failed to restart recognition. Please try again.');
              setIsRetrying(false);
            }
          }
        }, retryDelay);
      } else {
        setIsRetrying(false);
        setRetryCount(0);
      }
    };

    recognition.onerror = (event: any) => {
      
      setIsListening(false);
      
      switch (event.error) {
        case 'no-speech':
          if (!isManualStopRef.current && retryCount < maxRetries) {
            setIsRetrying(true);
            // Let onend handle the retry
          } else {
            setError('No speech detected. Please try speaking again.');
            setIsRetrying(false);
          }
          break;
        case 'audio-capture':
          setError('No microphone detected. Please check your microphone settings.');
          setHasPermission(false);
          setIsRetrying(false);
          break;
        case 'not-allowed':
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
          setHasPermission(false);
          setIsRetrying(false);
          break;
        case 'network':
          if (!isManualStopRef.current && retryCount < maxRetries) {
            setIsRetrying(true);
            // Let onend handle the retry
          } else {
            setError('Network error. Please check your internet connection.');
            setIsRetrying(false);
          }
          break;
        case 'aborted':
          setIsRetrying(false);
          // Don't show error for user-initiated stops
          break;
        default:
          setError(`Recognition error: ${event.error}. Please try again.`);
          setIsRetrying(false);
      }
    };

    recognition.onresult = (event: any) => {
      
      setRetryCount(0);
      setIsRetrying(false);
      
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultTranscript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        
        if (event.results[i].isFinal) {
          finalTranscript += resultTranscript;
          
          // In conversation mode, accumulate final transcripts
          if (isConversationMode) {
            accumulatedTranscriptRef.current += resultTranscript + ' ';
          }
        } else {
          interimTranscript += resultTranscript;
        }
      }

      // Set the current transcript for display
      const newTranscript = isConversationMode 
        ? accumulatedTranscriptRef.current + interimTranscript
        : (finalTranscript || interimTranscript).trim();
      
      setTranscript(newTranscript);
      currentTranscriptRef.current = newTranscript;
      
      // In conversation mode, detect end of speech with silence
      if (isConversationMode && finalTranscript) {
        
        // Start or reset the silence timer
        if (conversationTimeoutRef.current) {
          clearTimeout(conversationTimeoutRef.current);
        }
        
        // Start tracking silence
        silenceStartTimeRef.current = Date.now();
        
        // Start a timer to update the visual countdown
        if (silenceTimerIntervalRef.current) {
          clearInterval(silenceTimerIntervalRef.current);
        }
        
        silenceTimerIntervalRef.current = setInterval(() => {
          if (silenceStartTimeRef.current) {
            const elapsed = Date.now() - silenceStartTimeRef.current;
            const remaining = Math.max(0, conversationSilenceThreshold - elapsed);
            setSilenceTimer(Math.round((remaining / conversationSilenceThreshold) * 100));
            
            if (remaining <= 0) {
              clearInterval(silenceTimerIntervalRef.current!);
              silenceTimerIntervalRef.current = null;
            }
          }
        }, 50);
        
        // Set a new timeout to detect end of speech
        conversationTimeoutRef.current = setTimeout(() => {
          
          // Only process if we have accumulated transcript
          if (accumulatedTranscriptRef.current.trim()) {
            const finalAccumulatedTranscript = accumulatedTranscriptRef.current.trim();
            
            // Set flag to indicate we're awaiting speech end processing
            setIsAwaitingSpeechEnd(true);
            
            // Call the callback with the accumulated transcript
            if (onSpeechEndDetected) {
              onSpeechEndDetected(finalAccumulatedTranscript);
            }
            
            // Reset accumulated transcript
            accumulatedTranscriptRef.current = '';
            setTranscript('');
            currentTranscriptRef.current = '';
            
            // Reset silence timer
            silenceStartTimeRef.current = null;
            setSilenceTimer(0);
            
            // Clear the interval
            if (silenceTimerIntervalRef.current) {
              clearInterval(silenceTimerIntervalRef.current);
              silenceTimerIntervalRef.current = null;
            }
          }
        }, conversationSilenceThreshold);
      }
      
      // If we have a final result in non-conversation mode, stop listening
      if (!isConversationMode && finalTranscript.trim()) {
        isManualStopRef.current = true;
        try {
          recognition.stop();
        } catch (err) {
      // Intentionally empty - error handling not required
        }
      }
    };

    // Update continuous property when conversation mode changes
    if (recognitionRef.current) {
      recognitionRef.current.continuous = isConversationMode;
    }

    // Cleanup
    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (err) {
      // Intentionally empty - error handling not required
        }
      }
      
      if (conversationTimeoutRef.current) {
        clearTimeout(conversationTimeoutRef.current);
      }
      
      if (silenceTimerIntervalRef.current) {
        clearInterval(silenceTimerIntervalRef.current);
      }
    };
  }, [isConversationMode, onSpeechEndDetected, conversationSilenceThreshold]); // Add dependencies for conversation mode

  const startListening = useCallback(async () => {
    
    if (!recognitionRef.current) {
      setError('Speech recognition not initialized');
      return;
    }
    
    if (isListening) {
      return;
    }
    
    if (!hasPermission) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        setError(null);
      } catch (err) {
      // Intentionally empty - error handling not required
        setHasPermission(false);
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
        return;
      }
    }
    
    // Reset state
    setError(null);
    setTranscript('');
    currentTranscriptRef.current = '';
    setRetryCount(0);
    setIsRetrying(false);
    isManualStopRef.current = false;
    setIsAwaitingSpeechEnd(false);
    
    // Reset silence timer
    silenceStartTimeRef.current = null;
    setSilenceTimer(0);
    
    // Update continuous property based on conversation mode
    if (recognitionRef.current) {
      recognitionRef.current.continuous = isConversationMode;
    }
    
    try {
      recognitionRef.current.start();
    } catch (error: any) {
      // Intentionally empty - error handling not required
      setIsListening(false);
      setIsRetrying(false);
      
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
        setHasPermission(false);
      } else if (error.name === 'InvalidStateError') {
        setError('Recognition is already running. Please wait and try again.');
      } else {
        setError(`Failed to start recognition: ${error.message}`);
      }
    }
  }, [hasPermission, isListening, isConversationMode]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) {
      return;
    }
    
    isManualStopRef.current = true;
    setRetryCount(0);
    setIsRetrying(false);
    setIsAwaitingSpeechEnd(false);
    
    // Clear conversation timeout if it exists
    if (conversationTimeoutRef.current) {
      clearTimeout(conversationTimeoutRef.current);
      conversationTimeoutRef.current = null;
    }
    
    // Clear silence timer interval
    if (silenceTimerIntervalRef.current) {
      clearInterval(silenceTimerIntervalRef.current);
      silenceTimerIntervalRef.current = null;
    }
    
    // Reset silence timer
    silenceStartTimeRef.current = null;
    setSilenceTimer(0);
    
    try {
      recognitionRef.current.stop();
    } catch (error) {
      // Intentionally empty - error handling not required
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    currentTranscriptRef.current = '';
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    isManualStopRef.current = false;
    accumulatedTranscriptRef.current = '';
    setIsAwaitingSpeechEnd(false);
    
    // Reset silence timer
    silenceStartTimeRef.current = null;
    setSilenceTimer(0);
  }, []);

  const toggleConversationMode = useCallback(() => {
    
    // Stop listening if currently active
    if (isListening) {
      stopListening();
    }
    
    // Toggle the mode
    setIsConversationMode(prev => !prev);
    
    // Reset accumulated transcript
    accumulatedTranscriptRef.current = '';
    setTranscript('');
    currentTranscriptRef.current = '';
    setIsAwaitingSpeechEnd(false);
    
    // Reset silence timer
    silenceStartTimeRef.current = null;
    setSilenceTimer(0);
    
  }, [isConversationMode, isListening, stopListening]);

  return {
    isListening,
    transcript,
    browserSupportsSpeechRecognition,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isRetrying,
    isSupportedBrowser: browserSupportsSpeechRecognition,
    hasPermission,
    isConversationMode,
    toggleConversationMode,
    isAwaitingSpeechEnd,
    silenceTimer
  };
};

export default useVoiceRecognition;