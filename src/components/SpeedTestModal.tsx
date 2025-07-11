import React, { useState, useRef, useEffect } from 'react';
import { X, Wifi, Download, Upload, RotateCcw, ExternalLink, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';

interface SpeedTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const SpeedTestModal: React.FC<SpeedTestModalProps> = ({ 
  isOpen, 
  onClose,
  onSoundPlay
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle iframe loading state
  useEffect(() => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setLoadError(null);
    
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setLoadError('Speed test is taking too long to load. Please try again or visit the speed test website directly.');
      }
    }, 15000); // 15 second timeout
    
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setLoadError(null);
    if (onSoundPlay) {
      onSoundPlay('success');
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setLoadError('Failed to load speed test. Please check your internet connection or try again later.');
    if (onSoundPlay) {
      onSoundPlay('error');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setLoadError(null);
    
    if (iframeRef.current) {
      iframeRef.current.src = 'https://speedtest.mybroadband.co.za/';
    }
    
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handleOpenExternal = () => {
    window.open('https://speedtest.mybroadband.co.za/', '_blank');
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="speed-test-title"
    >
      <div 
        className={`bg-white rounded-xl border border-gray-300 shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen 
            ? 'w-full h-full rounded-none border-0' 
            : 'max-w-4xl w-full max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wifi className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 id="speed-test-title" className="text-lg font-bold text-gray-900">Internet Speed Test</h2>
              <p className="text-sm text-gray-600">Test your connection speed and latency</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"} position="bottom">
              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </Tooltip>
            
            <Tooltip content="Open in new tab" position="bottom">
              <button
                onClick={handleOpenExternal}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open in new tab"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </Tooltip>
            
            <Tooltip content="Close" position="bottom">
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close speed test"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-gray-100">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10">
              <div className="mb-4">
                <LoadingSpinner size="lg" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Loading Speed Test</h3>
              <p className="text-gray-600 text-sm mb-6">Please wait while we initialize the test...</p>
              
              <div className="flex items-center justify-center gap-8 text-center">
                <div className="flex flex-col items-center">
                  <Download className="w-8 h-8 text-blue-500 mb-2" />
                  <div className="text-sm text-gray-700">Download Speed</div>
                </div>
                
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-green-500 mb-2" />
                  <div className="text-sm text-gray-700">Upload Speed</div>
                </div>
                
                <div className="flex flex-col items-center">
                  <Wifi className="w-8 h-8 text-purple-500 mb-2" />
                  <div className="text-sm text-gray-700">Ping & Latency</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {loadError && (
            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10 p-6">
              <div className="p-3 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Failed to Load Speed Test</h3>
              <p className="text-gray-600 text-sm mb-6 text-center max-w-md">{loadError}</p>
              
              <div className="flex gap-4">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
                
                <button
                  onClick={handleOpenExternal}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Browser
                </button>
              </div>
            </div>
          )}
          
          {/* Speed Test iFrame */}
          <iframe
            ref={iframeRef}
            src="https://speedtest.mybroadband.co.za/"
            className="w-full h-full border-0"
            title="Internet Speed Test"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Powered by MyBroadband Speed Test
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Download</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Upload</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Ping</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeedTestModal;