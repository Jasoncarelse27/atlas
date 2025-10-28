import { useEffect, useState } from 'react';

interface MobileFeatures {
  isMobile: boolean;
  isTablet: boolean;
  isPWA: boolean;
  canInstall: boolean;
  hasNativeShare: boolean;
  hasNativeCamera: boolean;
  hasNativeMicrophone: boolean;
  hasNativeSpeech: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: {
    width: number;
    height: number;
  };
}

export const useMobileOptimization = () => {
  const [features, setFeatures] = useState<MobileFeatures>({
    isMobile: false,
    isTablet: false,
    isPWA: false,
    canInstall: false,
    hasNativeShare: false,
    hasNativeCamera: false,
    hasNativeMicrophone: false,
    hasNativeSpeech: false,
    orientation: 'portrait',
    screenSize: { width: 0, height: 0 }
  });

  useEffect(() => {
    const updateMobileFeatures = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent.toLowerCase();

      // Detect device types
      const isMobile = width <= 768 || /mobile|android|iphone|ipad|phone/i.test(userAgent);
      const isTablet = width > 768 && width <= 1024;
      
      // Detect PWA capabilities
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      
      // Check native API support
      const hasNativeShare = 'share' in navigator;
      const hasNativeCamera = 'mediaDevices' in navigator;
      const hasNativeMicrophone = 'mediaDevices' in navigator;
      const hasNativeSpeech = 'speechSynthesis' in window && 'SpeechRecognition' in window;
      
      // Check if app can be installed
      const canInstall = 'serviceWorker' in navigator && 'PushManager' in window;

      setFeatures({
        isMobile,
        isTablet,
        isPWA,
        canInstall,
        hasNativeShare,
        hasNativeCamera,
        hasNativeMicrophone,
        hasNativeSpeech,
        orientation: width > height ? 'landscape' : 'portrait',
        screenSize: { width, height }
      });
    };

    updateMobileFeatures();
    window.addEventListener('resize', updateMobileFeatures);
    window.addEventListener('orientationchange', updateMobileFeatures);

    return () => {
      window.removeEventListener('resize', updateMobileFeatures);
      window.removeEventListener('orientationchange', updateMobileFeatures);
    };
  }, []);

  // Native share functionality
  const shareContent = async (data: { title?: string; text?: string; url?: string }) => {
    if (features.hasNativeShare) {
      try {
        await navigator.share(data);
        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    }
    return { success: false, error: 'Native sharing not supported' };
  };

  // Install PWA
  const installPWA = async () => {
    if (!features.canInstall) {
      return { success: false, error: 'PWA installation not supported' };
    }

    // This would typically be handled by a beforeinstallprompt event
    return { success: true };
  };

  // Get camera access
  const getCameraAccess = async () => {
    if (!features.hasNativeCamera) {
      return { success: false, error: 'Camera not supported' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      return { success: true, stream };
    } catch (error) {
      return { success: false, error };
    }
  };

  // Get microphone access
  const getMicrophoneAccess = async () => {
    if (!features.hasNativeMicrophone) {
      return { success: false, error: 'Microphone not supported' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { success: true, stream };
    } catch (error) {
      return { success: false, error };
    }
  };

  // Haptic feedback (vibration)
  const triggerHaptic = (duration: number = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  };

  return {
    ...features,
    shareContent,
    installPWA,
    getCameraAccess,
    getMicrophoneAccess,
    triggerHaptic
  };
}; 