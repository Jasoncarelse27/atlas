import { Download, Headphones, Maximize2, Minimize2, Pause, Play, RotateCcw, Share2, SkipBack, SkipForward, Volume2, VolumeX, AudioWaveform as Waveform } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
  variant?: 'compact' | 'full' | 'minimal';
  showWaveform?: boolean;
  showDownload?: boolean;
  showShare?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title = "Audio Response",
  autoPlay = false,
  onEnded,
  className = '',
  variant = 'full',
  showWaveform = true,
  showDownload = true,
  showShare = true
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize audio context for waveform visualization
  useEffect(() => {
    if (showWaveform && audioRef.current && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } catch (err) {
        // Audio context setup failure is non-critical
      }
    }
  }, [showWaveform]);

  // Waveform animation
  useEffect(() => {
    if (showWaveform && isPlaying && canvasRef.current && analyserRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!analyserRef.current || !ctx) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
          
          const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.8)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          
          x += barWidth + 1;
        }
        
        animationRef.current = requestAnimationFrame(draw);
      };
      
      draw();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, showWaveform]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedData = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = () => {
      setError('Failed to load audio');
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [onEnded]);

  // Auto-play handling
  useEffect(() => {
    if (autoPlay && audioRef.current && !isLoading && !error) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise.catch(err => {
        });
      }
    }
  }, [autoPlay, isLoading, error]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        setError('Playback failed');
      });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!audioRef.current) return;
    
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const changePlaybackRate = (rate: number) => {
    if (!audioRef.current) return;
    
    setPlaybackRate(rate);
    audioRef.current.playbackRate = rate;
  };

  const downloadAudio = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `atlas-audio-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareAudio = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: 'Check out this audio response from Atlas',
          url: audioUrl
        });
      } catch (_err) {
        // Share cancelled or failed
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(audioUrl);
        // You could show a toast notification here
      } catch (_err) {
        // Failed to copy to clipboard
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm w-full max-w-full overflow-hidden ${className}`}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        {/* ✅ MOBILE FIX: Larger touch target (44x44px minimum) for mobile, red pause button */}
        <button
          onClick={togglePlayPause}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isLoading || !!error}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100 shadow-md touch-manipulation flex-shrink-0"
          style={{ touchAction: 'manipulation' }}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isLoading ? (
            <LoadingSpinner size="sm" color="white" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
          )}
        </button>
        
        {/* ✅ MOBILE FIX: Responsive text sizing and proper overflow handling with flex-shrink */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            {/* Hide title on very small screens, show on sm+ */}
            <div className="hidden sm:block text-sm font-medium text-gray-900 dark:text-white truncate mb-0.5">{title}</div>
            {/* ✅ MOBILE FIX: Larger, more readable time display on mobile */}
            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums truncate">
              {formatTime(currentTime)}<span className="text-gray-400 dark:text-gray-500 mx-0.5">/</span>{formatTime(duration)}
            </div>
          </div>
        </div>
        
        {/* ✅ MOBILE FIX: Close button with larger touch target and proper spacing - always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 sm:w-11 sm:h-11 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:text-gray-700 dark:active:text-gray-200 rounded-full transition-colors touch-manipulation flex-shrink-0 ml-auto"
          style={{ touchAction: 'manipulation' }}
          aria-label="Close audio player"
        >
          <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg ${className}`}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="p-3 bg-atlas-sage hover:bg-atlas-sage text-white rounded-full transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isLoading ? (
              <LoadingSpinner size="sm" color="white" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div 
              className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer relative overflow-hidden"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-gradient-to-r from-atlas-sage to-purple-500 rounded-full transition-all duration-150"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            {showDownload && (
              <Tooltip content="Download audio">
                <button
                  onClick={downloadAudio}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  aria-label="Download audio"
                >
                  <Download className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-gradient-to-br from-white/95 to-gray-50/90 dark:from-gray-800/95 dark:to-gray-900/90 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Headphones className="w-5 h-5 text-atlas-sage" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {error ? 'Error loading audio' : isLoading ? 'Loading...' : 'High-quality audio response'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip content={isExpanded ? "Collapse player" : "Expand player"}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label={isExpanded ? "Collapse player" : "Expand player"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Waveform Visualization */}
      {showWaveform && (
        <div className="relative h-24 bg-gradient-to-r from-atlas-sage/10 to-purple-500/10">
          <canvas
            ref={canvasRef}
            width={400}
            height={96}
            className="w-full h-full"
          />
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Waveform className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Main Controls */}
      <div className="p-4 sm:p-6">
        {/* Progress Bar */}
        <div className="mb-6">
          <div 
            className="h-3 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-gradient-to-r from-atlas-sage to-purple-500 rounded-full transition-all duration-150"
              style={{ width: `${progressPercentage}%` }}
            />
            <div 
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-atlas-sage rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercentage}% - 8px)` }}
            />
          </div>
          
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Tooltip content="Skip back 10s">
            <button
              onClick={() => skipTime(-10)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              aria-label="Skip back 10 seconds"
            >
              <SkipBack className="w-5 h-5" />
            </button>
          </Tooltip>
          
          <button
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="p-4 bg-gradient-to-r from-atlas-sage to-purple-500 hover:from-atlas-sage hover:to-purple-600 text-white rounded-full transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isLoading ? (
              <LoadingSpinner size="md" color="white" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>
          
          <Tooltip content="Skip forward 10s">
            <button
              onClick={() => skipTime(10)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              aria-label="Skip forward 10 seconds"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* Volume and Additional Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 accent-blue-500"
              aria-label="Volume control"
            />
          </div>

          {/* Playback Speed */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Speed:</span>
            <select
              value={playbackRate}
              onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
              className="text-sm bg-white border border-gray-300 rounded px-2 py-1"
              aria-label="Playback speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Tooltip content="Restart">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                aria-label="Restart audio"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </Tooltip>
            
            {showDownload && (
              <Tooltip content="Download">
                <button
                  onClick={downloadAudio}
                  className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                  aria-label="Download audio"
                >
                  <Download className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            
            {showShare && (
              <Tooltip content="Share">
                <button
                  onClick={shareAudio}
                  className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                  aria-label="Share audio"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Expanded Controls */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Duration:</span>
                <span className="ml-2 font-mono">{formatTime(duration)}</span>
              </div>
              <div>
                <span className="text-gray-600">Remaining:</span>
                <span className="ml-2 font-mono">{formatTime(duration - currentTime)}</span>
              </div>
              <div>
                <span className="text-gray-600">Format:</span>
                <span className="ml-2">MP3</span>
              </div>
              <div>
                <span className="text-gray-600">Quality:</span>
                <span className="ml-2">High</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-t border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;