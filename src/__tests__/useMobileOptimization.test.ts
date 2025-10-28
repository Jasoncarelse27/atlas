/**
 * Unit Tests - Mobile Optimization Hook
 * Tests mobile feature detection, haptics, and native APIs
 */

import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useMobileOptimization Hook', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original navigator and window
    global.navigator = originalNavigator;
    global.window = originalWindow;
  });

  describe('Mobile Detection', () => {
    it('should detect mobile device from viewport width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.screenSize.width).toBe(375);
      expect(result.current.screenSize.height).toBe(667);
    });

    it('should detect mobile device from user agent', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isMobile).toBe(true);
    });

    it('should detect tablet devices', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1024, configurable: true });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
    });

    it('should detect desktop devices', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
    });
  });

  describe('Orientation Detection', () => {
    it('should detect portrait orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.orientation).toBe('portrait');
    });

    it('should detect landscape orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 667, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 375, configurable: true });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.orientation).toBe('landscape');
    });

    it('should update orientation on window resize', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });

      const { result, rerender } = renderHook(() => useMobileOptimization());

      expect(result.current.orientation).toBe('portrait');

      // Simulate rotation
      Object.defineProperty(window, 'innerWidth', { value: 667, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 375, configurable: true });

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      rerender();

      expect(result.current.orientation).toBe('landscape');
    });
  });

  describe('PWA Detection', () => {
    it('should detect standalone PWA mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({ matches: true }),
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isPWA).toBe(true);
    });

    it('should detect iOS standalone mode', () => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isPWA).toBe(true);
    });

    it('should return false when not in PWA mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({ matches: false }),
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.isPWA).toBe(false);
    });
  });

  describe('Native API Detection', () => {
    it('should detect native share support', () => {
      Object.defineProperty(navigator, 'share', {
        value: vi.fn(),
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.hasNativeShare).toBe(true);
    });

    it('should detect camera support', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn() },
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.hasNativeCamera).toBe(true);
      expect(result.current.hasNativeMicrophone).toBe(true);
    });

    it('should detect speech synthesis support', () => {
      Object.defineProperty(window, 'speechSynthesis', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window, 'SpeechRecognition', {
        value: vi.fn(),
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.hasNativeSpeech).toBe(true);
    });

    it('should detect service worker support', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window, 'PushManager', {
        value: vi.fn(),
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      expect(result.current.canInstall).toBe(true);
    });
  });

  describe('shareContent()', () => {
    it('should share content successfully', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        value: mockShare,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const shareData = {
        title: 'Test Title',
        text: 'Test description',
        url: 'https://example.com',
      };

      const response = await result.current.shareContent(shareData);

      expect(response.success).toBe(true);
      expect(mockShare).toHaveBeenCalledWith(shareData);
    });

    it('should handle share cancellation', async () => {
      const mockShare = vi.fn().mockRejectedValue(new Error('AbortError'));
      Object.defineProperty(navigator, 'share', {
        value: mockShare,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.shareContent({ title: 'Test' });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should return error when share not supported', async () => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.shareContent({ title: 'Test' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Native sharing not supported');
    });
  });

  describe('getCameraAccess()', () => {
    it('should request camera access successfully', async () => {
      const mockGetUserMedia = vi.fn().mockResolvedValue({});
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.getCameraAccess();

      expect(response.success).toBe(true);
      expect(response.stream).toBeDefined();
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true });
    });

    it('should handle permission denied', async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.getCameraAccess();

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should return error when camera not supported', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.getCameraAccess();

      expect(response.success).toBe(false);
      expect(response.error).toBe('Camera not supported');
    });
  });

  describe('getMicrophoneAccess()', () => {
    it('should request microphone access successfully', async () => {
      const mockGetUserMedia = vi.fn().mockResolvedValue({});
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.getMicrophoneAccess();

      expect(response.success).toBe(true);
      expect(response.stream).toBeDefined();
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('should handle permission denied', async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.getMicrophoneAccess();

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('triggerHaptic()', () => {
    it('should trigger haptic feedback with vibration API', () => {
      const mockVibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      result.current.triggerHaptic(50);

      expect(mockVibrate).toHaveBeenCalledWith(50);
    });

    it('should use default duration when not specified', () => {
      const mockVibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      result.current.triggerHaptic();

      expect(mockVibrate).toHaveBeenCalledWith(10);
    });

    it('should handle missing vibration API gracefully', () => {
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      // Should not throw error
      expect(() => result.current.triggerHaptic(50)).not.toThrow();
    });

    it('should trigger pattern haptics', () => {
      const mockVibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      // Simulate completion pattern: 100-50-100
      result.current.triggerHaptic(100);
      result.current.triggerHaptic(50);
      result.current.triggerHaptic(100);

      expect(mockVibrate).toHaveBeenCalledTimes(3);
      expect(mockVibrate).toHaveBeenNthCalledWith(1, 100);
      expect(mockVibrate).toHaveBeenNthCalledWith(2, 50);
      expect(mockVibrate).toHaveBeenNthCalledWith(3, 100);
    });
  });

  describe('installPWA()', () => {
    it('should return success for PWA installation support', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window, 'PushManager', {
        value: vi.fn(),
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.installPWA();

      expect(response.success).toBe(true);
    });

    it('should return error when PWA not supported', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
      });

      const { result } = renderHook(() => useMobileOptimization());

      const response = await result.current.installPWA();

      expect(response.success).toBe(false);
      expect(response.error).toBe('PWA installation not supported');
    });
  });

  describe('Responsive Updates', () => {
    it('should update on window resize', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true, configurable: true });

      const { result, rerender } = renderHook(() => useMobileOptimization());

      expect(result.current.isMobile).toBe(true);

      // Simulate resize to desktop
      (window.innerWidth as any) = 1920;
      (window.innerHeight as any) = 1080;

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      rerender();

      expect(result.current.isMobile).toBe(false);
    });

    it('should update on orientation change', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true, configurable: true });

      const { result, rerender } = renderHook(() => useMobileOptimization());

      expect(result.current.orientation).toBe('portrait');

      // Simulate orientation change
      (window.innerWidth as any) = 667;
      (window.innerHeight as any) = 375;

      act(() => {
        window.dispatchEvent(new Event('orientationchange'));
      });

      rerender();

      expect(result.current.orientation).toBe('landscape');
    });
  });
});

