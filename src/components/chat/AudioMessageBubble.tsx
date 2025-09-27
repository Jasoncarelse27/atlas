import { Pause, Play, Volume2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Message } from '../../types/chat';

interface AudioMessageBubbleProps {
  message: Message;
  className?: string;
}

export function AudioMessageBubble({ message, className = '' }: AudioMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Get audio URL from message content or metadata
  const audioUrl = message.metadata?.audioUrl || 
                  (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return (
      <div className={`my-2 rounded-xl bg-gray-800 p-3 text-white ${className}`}>
        🎤 Audio recording (no URL available)
      </div>
    );
  }

  return (
    <div className={`my-2 rounded-xl bg-gray-800 p-3 text-white ${className}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="flex items-center justify-center w-10 h-10 bg-[#B2BDA3] hover:bg-[#A3B295] rounded-full transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-black" />
          ) : (
            <Play className="w-5 h-5 text-black ml-0.5" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Audio recording</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-1">
              <div 
                className="bg-[#B2BDA3] h-1 rounded-full transition-all"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
    </div>
  );
}
