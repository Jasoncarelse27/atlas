import { useCallback, useRef } from 'react';
import { useCustomization } from './useCustomization';

export type SoundType = 
  | 'click' 
  | 'start_listening' 
  | 'stop_listening' 
  | 'send_message' 
  | 'success' 
  | 'error' 
  | 'notification' 
  | 'hover'
  | 'toggle'
  | 'modal_open'
  | 'modal_close';

export type SoundTheme = 'apple' | 'minimal' | 'classic' | 'none';

interface UseSoundEffectsReturn {
  playSound: (soundType: SoundType) => void;
  isEnabled: boolean;
  soundTheme: SoundTheme;
  volume: number;
  setVolume: (volume: number) => void;
}

// Create a single shared audio context
let sharedAudioContext: AudioContext | null = null;

// Create audio context on demand
const getAudioContext = () => {
  if (!sharedAudioContext && typeof window !== 'undefined') {
    try {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      // Intentionally empty - error handling not required
    }
  }
  return sharedAudioContext;
};

// Generate Apple-like sounds
const generateAppleSound = (audioContext: AudioContext, soundType: SoundType, volume: number = 0.5) => {
  const masterGain = audioContext.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(audioContext.destination);
  
  switch (soundType) {
    case 'click': {
      // Apple-like tap sound - short, crisp, high-pitched
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.08);
      break;
    }
    
    case 'success': {
      // Apple-like success sound - pleasant ascending tone
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator1.frequency.setValueAtTime(1320, audioContext.currentTime + 0.1); // E6
      
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1); // C#6
      oscillator2.frequency.setValueAtTime(1760, audioContext.currentTime + 0.2); // A6
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.2);
      oscillator2.start(audioContext.currentTime + 0.1);
      oscillator2.stop(audioContext.currentTime + 0.4);
      break;
    }
    
    case 'error': {
      // Apple-like error sound - subtle descending tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(330, audioContext.currentTime + 0.2); // E4
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    }
    
    case 'notification': {
      // Apple-like notification sound - two-tone alert
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1100, audioContext.currentTime + 0.15); // C#6
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.17);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.15);
      oscillator2.start(audioContext.currentTime + 0.15);
      oscillator2.stop(audioContext.currentTime + 0.3);
      break;
    }
    
    case 'toggle': {
      // Apple-like toggle sound - subtle click
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    }
    
    case 'modal_open': {
      // Apple-like modal open sound - subtle ascending tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.2); // A5
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    }
    
    case 'modal_close': {
      // Apple-like modal close sound - subtle descending tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.2); // A4
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    }
    
    case 'start_listening': {
      // Apple-like start recording sound - subtle ascending tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.1); // E6
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    }
    
    case 'stop_listening': {
      // Apple-like stop recording sound - subtle descending tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1320, audioContext.currentTime); // E6
      oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    }
    
    case 'send_message': {
      // Apple-like message sent sound - subtle whoosh
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, audioContext.currentTime);
      filter.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    }
    
    default: {
      // Default subtle click
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    }
  }
};

// Generate minimal sounds (very subtle, professional)
const generateMinimalSound = (audioContext: AudioContext, soundType: SoundType, volume: number = 0.5) => {
  const masterGain = audioContext.createGain();
  masterGain.gain.value = volume * 0.7; // Reduce volume for minimal theme
  masterGain.connect(audioContext.destination);
  
  switch (soundType) {
    case 'click': {
      // Minimal click - very subtle
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.03);
      break;
    }
    
    case 'success': {
      // Minimal success - subtle high tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1800, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      break;
    }
    
    case 'error': {
      // Minimal error - subtle low tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      break;
    }
    
    // For other sound types, use very subtle versions
    default: {
      // Default minimal sound - barely audible click
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.03);
    }
  }
};

// Generate classic UI sounds (more pronounced)
const generateClassicSound = (audioContext: AudioContext, soundType: SoundType, volume: number = 0.5) => {
  const masterGain = audioContext.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(audioContext.destination);
  
  switch (soundType) {
    case 'click': {
      // Classic click - more pronounced
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    }
    
    case 'success': {
      // Classic success - ascending arpeggio
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const oscillator3 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(523, audioContext.currentTime); // C5
      
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
      
      oscillator3.type = 'sine';
      oscillator3.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      oscillator3.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.15);
      oscillator2.start(audioContext.currentTime + 0.1);
      oscillator2.stop(audioContext.currentTime + 0.25);
      oscillator3.start(audioContext.currentTime + 0.2);
      oscillator3.stop(audioContext.currentTime + 0.4);
      break;
    }
    
    case 'error': {
      // Classic error - descending tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    }
    
    case 'notification': {
      // Classic notification - double beep
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1100, audioContext.currentTime + 0.15); // C#6
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.16);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.15);
      oscillator2.start(audioContext.currentTime + 0.15);
      oscillator2.stop(audioContext.currentTime + 0.3);
      break;
    }
    
    default: {
      // Default classic sound - simple beep
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  }
};

export const useSoundEffects = (): UseSoundEffectsReturn => {
  const { customization } = useCustomization();
  const volumeRef = useRef<number>(0.5); // Default volume
  
  // Get sound preferences from customization
  const isEnabled = customization?.preferences?.soundEffects ?? true;
  const soundTheme: SoundTheme = customization?.preferences?.soundTheme || 'apple';
  
  // Get volume from customization or use default
  const volume = customization?.preferences?.soundVolume ?? 0.5;
  
  // Update volume ref when it changes in customization
  if (volume !== volumeRef.current) {
    volumeRef.current = volume;
  }
  
  const setVolume = useCallback((newVolume: number) => {
    volumeRef.current = newVolume;
  }, []);

  const playSound = useCallback((soundType: SoundType) => {
    // Don't play sounds if disabled in preferences
    if (!isEnabled || soundTheme === 'none') return;
    
    try {
      const audioContext = getAudioContext();
      if (!audioContext) {
        return;
      }
      
      // Resume audio context if it's suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          // Play sound based on selected theme
          switch (soundTheme) {
            case 'apple':
              generateAppleSound(audioContext, soundType, volumeRef.current);
              break;
            case 'minimal':
              generateMinimalSound(audioContext, soundType, volumeRef.current);
              break;
            case 'classic':
              generateClassicSound(audioContext, soundType, volumeRef.current);
              break;
            default:
              // No sound if theme is 'none'
              break;
          }
        }).catch(err => {
        });
      } else {
        // Play sound based on selected theme
        switch (soundTheme) {
          case 'apple':
            generateAppleSound(audioContext, soundType, volumeRef.current);
            break;
          case 'minimal':
            generateMinimalSound(audioContext, soundType, volumeRef.current);
            break;
          case 'classic':
            generateClassicSound(audioContext, soundType, volumeRef.current);
            break;
          default:
            // No sound if theme is 'none'
            break;
        }
      }
      
    } catch (error) {
      // Intentionally empty - error handling not required
    }
  }, [isEnabled, soundTheme]);

  return { 
    playSound, 
    isEnabled, 
    soundTheme,
    volume: volumeRef.current,
    setVolume
  };
};

export default useSoundEffects;