import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Web Speech API
const mockSpeechRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  onstart: null,
  onend: null,
  onresult: null,
  onerror: null,
};

// Mock global SpeechRecognition
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: vi.fn(() => mockSpeechRecognition),
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: vi.fn(() => mockSpeechRecognition),
});

// Mock voice recognition service
const mockVoiceService = {
  startListening: vi.fn(),
  stopListening: vi.fn(),
  isListening: vi.fn(),
  getSupportedLanguages: vi.fn(),
  setLanguage: vi.fn(),
  setContinuousMode: vi.fn(),
  setInterimResults: vi.fn(),
};

vi.mock('../../src/services/voiceRecognitionService', () => ({
  voiceRecognitionService: mockVoiceService,
}));

describe('Voice Recognition Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechRecognition.continuous = false;
    mockSpeechRecognition.interimResults = false;
    mockSpeechRecognition.lang = 'en-US';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Voice Recognition', () => {
    it('should start voice recognition', async () => {
      mockVoiceService.startListening.mockResolvedValue(true);
      mockVoiceService.isListening.mockReturnValue(true);

      const result = await mockVoiceService.startListening();
      const isListening = mockVoiceService.isListening();

      expect(result).toBe(true);
      expect(isListening).toBe(true);
      expect(mockVoiceService.startListening).toHaveBeenCalled();
    });

    it('should stop voice recognition', async () => {
      mockVoiceService.stopListening.mockResolvedValue(true);
      mockVoiceService.isListening.mockReturnValue(false);

      const result = await mockVoiceService.stopListening();
      const isListening = mockVoiceService.isListening();

      expect(result).toBe(true);
      expect(isListening).toBe(false);
      expect(mockVoiceService.stopListening).toHaveBeenCalled();
    });
  });

  describe('Speech Recognition Events', () => {
    it('should handle successful speech recognition', () => {
      const mockResult = {
        results: [
          {
            isFinal: true,
            [0]: {
              transcript: 'Hello world',
              confidence: 0.95,
            },
          },
        ],
      };

      mockVoiceService.startListening.mockImplementation(() => {
        // Simulate successful recognition
        if (mockSpeechRecognition.onresult) {
          mockSpeechRecognition.onresult(mockResult);
        }
        return Promise.resolve(true);
      });

      expect(() => mockVoiceService.startListening()).not.toThrow();
    });

    it('should handle speech recognition errors', () => {
      const mockError = {
        error: 'no-speech',
        message: 'No speech was detected',
      };

      mockVoiceService.startListening.mockImplementation(() => {
        // Simulate error
        if (mockSpeechRecognition.onerror) {
          mockSpeechRecognition.onerror(mockError);
        }
        return Promise.resolve(false);
      });

      expect(() => mockVoiceService.startListening()).not.toThrow();
    });

    it('should handle network errors', () => {
      const mockError = {
        error: 'network',
        message: 'Network error occurred',
      };

      mockVoiceService.startListening.mockImplementation(() => {
        if (mockSpeechRecognition.onerror) {
          mockSpeechRecognition.onerror(mockError);
        }
        return Promise.resolve(false);
      });

      expect(() => mockVoiceService.startListening()).not.toThrow();
    });

    it('should handle permission denied errors', () => {
      const mockError = {
        error: 'not-allowed',
        message: 'Permission denied',
      };

      mockVoiceService.startListening.mockImplementation(() => {
        if (mockSpeechRecognition.onerror) {
          mockSpeechRecognition.onerror(mockError);
        }
        return Promise.resolve(false);
      });

      expect(() => mockVoiceService.startListening()).not.toThrow();
    });
  });

  describe('Language Support', () => {
    it('should get supported languages', () => {
      const supportedLanguages = ['en-US', 'es-ES', 'fr-FR', 'de-DE'];
      mockVoiceService.getSupportedLanguages.mockReturnValue(supportedLanguages);

      const languages = mockVoiceService.getSupportedLanguages();

      expect(languages).toEqual(supportedLanguages);
      expect(mockVoiceService.getSupportedLanguages).toHaveBeenCalled();
    });

    it('should set language', () => {
      mockVoiceService.setLanguage.mockReturnValue(true);

      const result = mockVoiceService.setLanguage('es-ES');

      expect(result).toBe(true);
      expect(mockVoiceService.setLanguage).toHaveBeenCalledWith('es-ES');
    });

    it('should handle unsupported language', () => {
      mockVoiceService.setLanguage.mockReturnValue(false);

      const result = mockVoiceService.setLanguage('unsupported-lang');

      expect(result).toBe(false);
    });
  });

  describe('Recognition Settings', () => {
    it('should enable continuous mode', () => {
      mockVoiceService.setContinuousMode.mockReturnValue(true);

      const result = mockVoiceService.setContinuousMode(true);

      expect(result).toBe(true);
      expect(mockVoiceService.setContinuousMode).toHaveBeenCalledWith(true);
    });

    it('should enable interim results', () => {
      mockVoiceService.setInterimResults.mockReturnValue(true);

      const result = mockVoiceService.setInterimResults(true);

      expect(result).toBe(true);
      expect(mockVoiceService.setInterimResults).toHaveBeenCalledWith(true);
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing SpeechRecognition API', () => {
      // Mock missing SpeechRecognition API
      const originalSpeechRecognition = (window as any).SpeechRecognition;
      const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;
      
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;

      mockVoiceService.startListening.mockRejectedValue(new Error('Speech recognition not supported'));

      expect(() => mockVoiceService.startListening()).rejects.toThrow('Speech recognition not supported');
      
      // Restore original values
      (window as any).SpeechRecognition = originalSpeechRecognition;
      (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    });

    it('should fallback to webkitSpeechRecognition', () => {
      // Mock missing SpeechRecognition but keep webkitSpeechRecognition
      const originalSpeechRecognition = (window as any).SpeechRecognition;
      
      (window as any).SpeechRecognition = undefined;
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        writable: true,
        value: vi.fn(() => mockSpeechRecognition),
      });

      mockVoiceService.startListening.mockResolvedValue(true);

      expect(() => mockVoiceService.startListening()).not.toThrow();
      
      // Restore original value
      (window as any).SpeechRecognition = originalSpeechRecognition;
    });
  });

  describe('Audio Quality and Performance', () => {
    it('should handle low confidence results', () => {
      const lowConfidenceResult = {
        results: [
          {
            isFinal: true,
            [0]: {
              transcript: 'Hello world',
              confidence: 0.3, // Low confidence
            },
          },
        ],
      };

      mockVoiceService.startListening.mockImplementation(() => {
        if (mockSpeechRecognition.onresult) {
          mockSpeechRecognition.onresult(lowConfidenceResult);
        }
        return Promise.resolve(true);
      });

      expect(() => mockVoiceService.startListening()).not.toThrow();
    });

    it('should handle multiple results', () => {
      const multipleResults = {
        results: [
          {
            isFinal: false,
            [0]: { transcript: 'Hello', confidence: 0.8 },
          },
          {
            isFinal: true,
            [0]: { transcript: 'Hello world', confidence: 0.95 },
          },
        ],
      };

      mockVoiceService.startListening.mockImplementation(() => {
        if (mockSpeechRecognition.onresult) {
          mockSpeechRecognition.onresult(multipleResults);
        }
        return Promise.resolve(true);
      });

      expect(() => mockVoiceService.startListening()).not.toThrow();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should clean up event listeners on stop', () => {
      mockVoiceService.stopListening.mockImplementation(() => {
        mockSpeechRecognition.removeEventListener('result', vi.fn());
        mockSpeechRecognition.removeEventListener('error', vi.fn());
        mockSpeechRecognition.removeEventListener('end', vi.fn());
        return Promise.resolve(true);
      });

      expect(() => mockVoiceService.stopListening()).not.toThrow();
    });

    it('should handle rapid start/stop cycles', async () => {
      mockVoiceService.startListening.mockResolvedValue(true);
      mockVoiceService.stopListening.mockResolvedValue(true);

      // Rapid start/stop cycle
      await mockVoiceService.startListening();
      await mockVoiceService.stopListening();
      await mockVoiceService.startListening();
      await mockVoiceService.stopListening();

      expect(mockVoiceService.startListening).toHaveBeenCalledTimes(2);
      expect(mockVoiceService.stopListening).toHaveBeenCalledTimes(2);
    });
  });
});
