import { useState, useEffect, useCallback, useRef } from 'react';

import { logger } from '../utils/logger';
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
    logger.info('=== VOICE RECOGNITION HOOK INITIALIZATION ===');
    
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition || 
                             (window as any).mozSpeechRecognition || 
                             (window as any).msSpeechRecognition;
                             
    logger.info('SpeechRecognition available:', !!SpeechRecognition);
    
    if (!SpeechRecognition) {
      logger.error('Speech recognition not supported');
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

    logger.info('Recognition configured with:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      maxAlternatives: recognition.maxAlternatives,
      lang: recognition.lang,
      isConversationMode
    });

    // Check microphone permission
    const checkPermission = async () => {
      logger.info('=== CHECKING MICROPHONE PERMISSION ===');
      try {
        // Try to get user media first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        logger.info('Microphone access granted');
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        setError(null);
      } catch (err) {
        logger.error('Permission check error:', err);
        setHasPermission(false);
        setError('Microphone access is required. Please allow microphone access in your browser settings.');
      }
    };

    checkPermission();

    // Event handlers
    recognition.onstart = () => {
      logger.info('=== SPEECH RECOGNITION STARTED ===');
      logger.info('Conversation mode:', isConversationMode);
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
      logger.info('=== SPEECH RECOGNITION ENDED ===');
      logger.info('Current transcript:', transcript);
      logger.info('Current transcript ref:', currentTranscriptRef.current);
      logger.info('Manual stop:', isManualStopRef.current);
      logger.info('Retry count:', retryCount);
      logger.info('Is retrying:', isRetrying);
      logger.info('Conversation mode:', isConversationMode);
      logger.info('Is awaiting speech end:', isAwaitingSpeechEnd);
      
      setIsListening(false);

      // Clear silence timer interval
      if (silenceTimerIntervalRef.current) {
        clearInterval(silenceTimerIntervalRef.current);
        silenceTimerIntervalRef.current = null;
      }

      // Handle conversation mode restart
      if (isConversationMode && !isManualStopRef.current && !isAwaitingSpeechEnd) {
        logger.info('In conversation mode, restarting recognition...');
        try {
          // Small delay before restarting to allow processing
          setTimeout(() => {
            if (recognitionRef.current && !isManualStopRef.current) {
              recognitionRef.current.start();
            }
          }, 300);
        } catch (err) {
          logger.error('Failed to restart recognition in conversation mode:', err);
          setError('Failed to maintain conversation mode. Please try again.');
        }
        return;
      }

      // Only retry if not manually stopped, retrying is enabled, and we haven't exceeded max retries
      if (!isManualStopRef.current && isRetrying && retryCount < maxRetries && hasPermission) {
        logger.info('Attempting retry due to previous error...');
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          if (recognitionRef.current && !isManualStopRef.current) {
            try {
              logger.info('Restarting recognition after error...');
              recognitionRef.current.start();
            } catch (err) {
              logger.error('Failed to restart recognition:', err);
              setError('Failed to restart recognition. Please try again.');
              setIsRetrying(false);
            }
          }
        }, retryDelay);
      } else if (!isManualStopRef.current && !currentTranscriptRef.current.trim() && retryCount < maxRetries && !error && hasPermission) {
        // Original retry logic for no transcript
        logger.info('No transcript detected, attempting retry...');
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          if (recognitionRef.current && !isManualStopRef.current) {
            try {
              logger.info('Restarting recognition...');
              recognitionRef.current.start();
            } catch (err) {
              logger.error('Failed to restart recognition:', err);
              setError('Failed to restart recognition. Please try again.');
              setIsRetrying(false);
            }
          }
        }, retryDelay);
      } else {
        logger.info('Not retrying - conditions not met');
        setIsRetrying(false);
        setRetryCount(0);
      }
    };

    recognition.onerror = (_event: unknown) => {
      logger.info('=== SPEECH RECOGNITION ERROR ===');
      logger.info('Error type:', event.error);
      logger.info('Error message:', event.message);
      
      setIsListening(false);
      
      switch (event.error) {
        case 'no-speech':
          logger.info('No speech detected');
          if (!isManualStopRef.current && retryCount < maxRetries) {
            setIsRetrying(true);
            // Let onend handle the retry
          } else {
            setError('No speech detected. Please try speaking again.');
            setIsRetrying(false);
          }
          break;
        case 'audio-capture':
          logger.info('Audio capture error');
          setError('No microphone detected. Please check your microphone settings.');
          setHasPermission(false);
          setIsRetrying(false);
          break;
        case 'not-allowed':
          logger.info('Permission denied');
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
          setHasPermission(false);
          setIsRetrying(false);
          break;
        case 'network':
          logger.info('Network error');
          if (!isManualStopRef.current && retryCount < maxRetries) {
            logger.info('Network error - will retry');
            setIsRetrying(true);
            // Let onend handle the retry
          } else {
            setError('Network error. Please check your internet connection.');
            setIsRetrying(false);
          }
          break;
        case 'aborted':
          logger.info('Recognition aborted');
          setIsRetrying(false);
          // Don't show error for user-initiated stops
          break;
        default:
          logger.info('Unknown error:', event.error);
          setError(`Recognition error: ${event.error}. Please try again.`);
          setIsRetrying(false);
      }
    };

    recognition.onresult = (_event: unknown) => {
      logger.info('=== SPEECH RECOGNITION RESULT ===');
      logger.info('Event results length:', event.results.length);
      logger.info('Conversation mode:', isConversationMode);
      logger.info('Is awaiting speech end:', isAwaitingSpeechEnd);
      
      setRetryCount(0);
      setIsRetrying(false);
      
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultTranscript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        logger.info(`Result ${i}: "${resultTranscript}" (final: ${event.results[i].isFinal}, confidence: ${confidence})`);
        
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
      
      logger.info('Setting transcript:', newTranscript);
      setTranscript(newTranscript);
      currentTranscriptRef.current = newTranscript;
      
      // In conversation mode, detect end of speech with silence
      if (isConversationMode && finalTranscript) {
        logger.info('Final transcript in conversation mode, setting silence timer');
        
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
          logger.info('Silence detected in conversation mode, processing speech');
          
          // Only process if we have accumulated transcript
          if (accumulatedTranscriptRef.current.trim()) {
            const finalAccumulatedTranscript = accumulatedTranscriptRef.current.trim();
            logger.info('Processing accumulated transcript:', finalAccumulatedTranscript);
            
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
        logger.info('Final transcript received in standard mode, stopping recognition');
        isManualStopRef.current = true;
        try {
          recognition.stop();
        } catch (err) {
          logger.error('Error stopping recognition:', err);
        }
      }
    };

    // Update continuous property when conversation mode changes
    if (recognitionRef.current) {
      recognitionRef.current.continuous = isConversationMode;
      logger.info('Updated recognition.continuous to:', isConversationMode);
    }

    // Cleanup
    return () => {
      logger.info('=== CLEANING UP VOICE RECOGNITION ===');
      if (recognition) {
        try {
          recognition.stop();
        } catch (err) {
          logger.error('Error during cleanup:', err);
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
    logger.info('=== START LISTENING CALLED ===');
    logger.info('Recognition available:', !!recognitionRef.current);
    logger.info('Has permission:', hasPermission);
    logger.info('Is listening:', isListening);
    logger.info('Conversation mode:', isConversationMode);
    
    if (!recognitionRef.current) {
      logger.error('No recognition object available');
      setError('Speech recognition not initialized');
      return;
    }
    
    if (isListening) {
      logger.info('Already listening, ignoring start request');
      return;
    }
    
    if (!hasPermission) {
      logger.info('No permission, requesting...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        logger.info('Permission granted');
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        setError(null);
      } catch (err) {
        logger.error('Permission denied:', err);
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
      logger.info('Set recognition.continuous to:', isConversationMode);
    }
    
    try {
      logger.info('Starting recognition...');
      recognitionRef.current.start();
    } catch (_error: unknown) {
      logger.error('Failed to start recognition:', error);
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
    logger.info('=== STOP LISTENING CALLED ===');
    if (!recognitionRef.current) {
      logger.error('No recognition object available');
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
      logger.info('Recognition stopped manually');
    } catch (error) {
      logger.error('Error stopping recognition:', error);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    logger.info('=== RESET TRANSCRIPT CALLED ===');
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
    logger.info('=== TOGGLE CONVERSATION MODE ===');
    logger.info('Current mode:', isConversationMode);
    
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
    
    logger.info('New mode will be:', !isConversationMode);
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