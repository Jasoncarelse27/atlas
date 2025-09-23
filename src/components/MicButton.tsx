import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useFeatureAccess } from '../hooks/useTierAccess';
import { FeatureService } from '../services/featureService';

interface MicButtonProps {
  onTranscribe: (text: string) => void;
}

export function MicButton({ onTranscribe }: MicButtonProps) {
  const { canUse, attemptFeature } = useFeatureAccess('audio');
  const { user } = useAuth();
  const [listening, setListening] = useState(false);
  const featureService = new FeatureService();

  const handlePress = async () => {
    // Check if user has access to audio features
    const hasAccess = await attemptFeature();
    if (!hasAccess) {
      // Log the blocked attempt
      if (user?.id) {
        await featureService.logAttempt(user.id, 'audio', 'free');
      }
      return; // attemptFeature already shows upgrade modal
    }

    // Log successful access
    if (user?.id) {
      await featureService.logAttempt(user.id, 'audio', 'free');
    }

    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      
      setListening(true);
      recognition.start();

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognized:', transcript);
        onTranscribe(transcript);
        setListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error(`Speech recognition error: ${event.error}`);
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast.error('Failed to start speech recognition');
      setListening(false);
    }
  };

  return (
    <button
      onClick={handlePress}
      disabled={!canUse || listening}
      className={`p-2 rounded-full transition-all duration-200 ${
        listening 
          ? 'bg-[#F4E5D9] text-[#8B7355] animate-pulse' 
          : canUse 
            ? 'bg-[#B2BDA3] text-white hover:bg-[#9BA892]' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
      }`}
      title={
        !canUse 
          ? 'Voice features available in Core & Studio plans' 
          : listening 
            ? 'Listening...' 
            : 'Hold to record voice message'
      }
    >
      🎤
    </button>
  );
}
