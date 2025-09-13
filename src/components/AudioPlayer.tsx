import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Download, Share2, RotateCcw, Maximize2, Minimize2, Settings, Headphones, AudioWaveform as Waveform } from 'lucide-react';
import Tooltip from './Tooltip';
import LoadingSpinner from './LoadingSpinner';

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
        console.warn('Web Audio API not supported:', err);
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
          console.warn('Auto-play failed:', err);
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
        console.error('Play failed:', err);
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
      <div className={`flex items-center gap-3 p-3 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm ${className}`}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        <button
          onClick={togglePlayPause}
          disabled={isLoading || !!error}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors disabled:opacity-50"
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isLoading ? (
            <LoadingSpinner size="sm" color="white" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{title}</div>
          <div className="text-xs text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        <button
          onClick={toggleMute}
          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200 shadow-lg ${className}`}>
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
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
              <span className="text-sm font-medium text-gray-900">{title}</span>
              <span className="text-xs text-gray-500">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div 
              className="h-2 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-150"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            {showDownload && (
              <Tooltip content="Download audio">
                <button
                  onClick={downloadAudio}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
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
    <div className={`bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-md rounded-2xl border border-gray-200 shadow-2xl overflow-hidden ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Headphones className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">
                {error ? 'Error loading audio' : isLoading ? 'Loading...' : 'High-quality audio response'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip content={isExpanded ? "Collapse player" : "Expand player"}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
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
        <div className="relative h-24 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
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
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-150"
              style={{ width: `${progressPercentage}%` }}
            />
            <div 
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
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