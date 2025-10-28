/**
 * Integration Tests - Mobile Browser Context
 * Tests ritual system with mobile viewport and user agent
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { ritualService } from '../../services/ritualService';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuid } from 'uuid';

// Check if we should use real Supabase or mocks
const useRealDB = !!process.env.SUPABASE_TEST_URL;

describe('Ritual System - Mobile Browser Context', () => {
  beforeEach(() => {
    // Simulate iOS mobile browser
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true
    });
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true, configurable: true });
  });

  it('should detect mobile context', () => {
    const { result } = renderHook(() => useMobileOptimization());
    
    expect(result.current.isMobile).toBe(true);
    expect(result.current.screenSize.width).toBe(375);
    expect(result.current.orientation).toBe('portrait');
  });

  it('should trigger haptic feedback on mobile', () => {
    const { result } = renderHook(() => useMobileOptimization());
    
    // Trigger haptic
    result.current.triggerHaptic(50);
    
    // Verify vibrate was called
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('should handle landscape orientation', () => {
    // Rotate to landscape
    Object.defineProperty(window, 'innerWidth', { value: 667, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 375, writable: true, configurable: true });
    
    const { result } = renderHook(() => useMobileOptimization());
    
    expect(result.current.orientation).toBe('landscape');
  });

  describe.skipIf(!useRealDB)('Mobile + Real Database', () => {
    let testUserId: string;
    let createdRitualIds: string[] = [];

    beforeEach(() => {
      testUserId = `mobile-test-${Date.now()}-${uuid()}`;
    });

    afterEach(async () => {
      if (createdRitualIds.length > 0) {
        await supabase.from('rituals').delete().in('id', createdRitualIds);
      }
      await supabase.from('rituals').delete().eq('user_id', testUserId);
      createdRitualIds = [];
    });

    it('should create ritual on mobile browser', async () => {
      const ritual = await ritualService.createRitual({
        userId: testUserId,
        title: 'Mobile Test Ritual',
        goal: 'energy',
        steps: [
          {
            id: uuid(),
            type: 'breathing',
            duration: 120,
            order: 0,
            config: {
              title: 'Mobile Breathing',
              instructions: 'Breathe on mobile'
            }
          }
        ],
        tierRequired: 'free',
      });

      createdRitualIds.push(ritual.id);

      expect(ritual.id).toBeDefined();
      expect(ritual.title).toBe('Mobile Test Ritual');
    });
  });
});

describe('Ritual System - Android Browser Context', () => {
  beforeEach(() => {
    // Simulate Android mobile browser
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      configurable: true
    });
    Object.defineProperty(window, 'innerWidth', { value: 360, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
  });

  it('should detect Android mobile context', () => {
    const { result } = renderHook(() => useMobileOptimization());
    
    expect(result.current.isMobile).toBe(true);
    expect(result.current.screenSize.width).toBe(360);
  });

  it('should handle Android-specific haptics', () => {
    const { result } = renderHook(() => useMobileOptimization());
    
    // Android vibration pattern
    result.current.triggerHaptic(100);
    
    expect(navigator.vibrate).toHaveBeenCalledWith(100);
  });
});

describe('Ritual System - Tablet Context', () => {
  beforeEach(() => {
    // Simulate iPad
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true
    });
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true, configurable: true });
  });

  it.skip('should detect tablet context', () => {
    const { result } = renderHook(() => useMobileOptimization());
    
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
  });
});

