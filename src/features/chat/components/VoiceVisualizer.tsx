import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceVisualizerProps {
  isListening: boolean;
  isProcessing: boolean;
  isMuted: boolean;
  audioLevel?: number;
  className?: string;
  enhanced?: boolean;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isListening,
  isProcessing,
  isMuted,
  audioLevel = 0,
  className = '',
  enhanced = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [bars, setBars] = useState<number[]>(new Array(16).fill(0));

  useEffect(() => {
    if (!isListening && !isProcessing) {
      setBars(new Array(16).fill(0));
      return;
    }

    const animate = () => {
      setBars(prev => prev.map((_, index) => {
        if (isProcessing) {
          // Smooth wave pattern for processing with more variation
          return Math.sin(Date.now() * 0.005 + index * 0.5) * 0.5 + 0.5 + 
                 Math.sin(Date.now() * 0.01 + index * 0.2) * 0.2; // Add secondary wave
        } else if (isListening) {
          // More dynamic bars with audio level influence
          const baseHeight = Math.random() * (audioLevel + 0.3);
          // Add variation based on position
          const positionFactor = Math.sin(index * 0.5) * 0.3 + 0.7;
          return baseHeight * positionFactor;
        }
        return 0;
      }));
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isProcessing, audioLevel]);

  // Enhanced canvas-based visualization
  useEffect(() => {
    if (!enhanced || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    let animationId: number;
    
    const drawVisualization = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!isListening && !isProcessing) {
        // Draw idle state
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.3;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(209, 213, 219, 0.3)';
        ctx.fill();
        
        // Draw icon
        ctx.fillStyle = isMuted ? 'rgba(239, 68, 68, 0.7)' : 'rgba(107, 114, 128, 0.7)';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isMuted ? '🔇' : '🎤', centerX, centerY);
        
        animationId = requestAnimationFrame(drawVisualization);
        return;
      }
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
      
      // Draw circular visualizer
      const barCount = 40; // Reduced for mobile
      const barWidth = (Math.PI * 2) / barCount;
      
      for (let i = 0; i < barCount; i++) {
        let barHeight;
        
        if (isProcessing) {
          // Processing animation - smooth wave
          barHeight = (Math.sin(Date.now() * 0.003 + i * 0.2) * 0.2 + 0.8) * maxRadius * 0.3;
        } else if (isListening) {
          // Listening animation - audio reactive
          const baseHeight = Math.random() * audioLevel * maxRadius * 0.5;
          const positionFactor = Math.sin(i * 0.2) * 0.3 + 0.7;
          barHeight = baseHeight * positionFactor + maxRadius * 0.2;
        } else {
          barHeight = maxRadius * 0.2;
        }
        
        const angle = i * barWidth;
        
        const innerRadius = maxRadius * 0.2;
        const outerRadius = innerRadius + barHeight;
        
        // Calculate points
        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * outerRadius;
        const y2 = centerY + Math.sin(angle) * outerRadius;
        
        // Draw bar
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 2; // Thinner lines for mobile
        
        // Color based on state
        let color;
        if (isMuted) {
          color = 'rgba(239, 68, 68, 0.7)'; // Red for muted
        } else if (isProcessing) {
          color = 'rgba(59, 130, 246, 0.7)'; // Blue for processing
        } else if (isListening) {
          color = 'rgba(16, 185, 129, 0.7)'; // Green for listening
        } else {
          color = 'rgba(107, 114, 128, 0.5)'; // Gray for idle
        }
        
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      
      // Draw center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * 0.18, 0, Math.PI * 2);
      
      // Fill based on state
      if (isMuted) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      } else if (isProcessing) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      } else if (isListening) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      } else {
        ctx.fillStyle = 'rgba(107, 114, 128, 0.2)';
      }
      
      ctx.fill();
      
      // Draw icon
      ctx.fillStyle = isMuted ? 'rgba(239, 68, 68, 0.9)' : 
                    isProcessing ? 'rgba(59, 130, 246, 0.9)' : 
                    isListening ? 'rgba(16, 185, 129, 0.9)' : 
                    'rgba(107, 114, 128, 0.9)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        isMuted ? '🔇' : 
        isProcessing ? '⚙️' : 
        isListening ? '🎤' : 
        '🔊', 
        centerX, centerY
      );
      
      animationId = requestAnimationFrame(drawVisualization);
    };
    
    drawVisualization();
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [enhanced, isListening, isProcessing, isMuted, audioLevel]);

  const getVisualizerColor = () => {
    if (isMuted) return 'bg-gray-400';
    if (isProcessing) return 'bg-blue-500';
    if (isListening) return 'bg-green-500';
    return 'bg-gray-300';
  };

  const getVisualizerGlow = () => {
    if (isMuted) return '';
    if (isProcessing) return 'shadow-lg shadow-blue-500/40';
    if (isListening) return 'shadow-lg shadow-green-500/40';
    return '';
  };

  const getStatusTextColor = () => {
    if (isMuted) return 'text-gray-500';
    if (isProcessing) return 'text-blue-600 font-medium';
    if (isListening) return 'text-green-600 font-medium';
    return 'text-gray-500';
  };

  // If enhanced mode is enabled, use canvas visualization
  if (enhanced) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full"
          />
        </div>
        
        {/* Status Text */}
        <div className="mt-2 sm:mt-3 text-xs sm:text-sm font-medium">
          {isMuted ? (
            <span className="text-red-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></span>
              Muted
            </span>
          ) : isProcessing ? (
            <span className="text-blue-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Processing...
            </span>
          ) : isListening ? (
            <span className="text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
              Listening
            </span>
          ) : (
            <span className="text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full"></span>
              Ready
            </span>
          )}
        </div>
      </div>
    );
  }

  // Original bar-based visualization
  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      {/* Status Icon with enhanced glow effect */}
      <div 
        className={`p-1.5 sm:p-2 rounded-full ${getVisualizerColor()} ${getVisualizerGlow()} transition-all duration-300 transform ${isListening ? 'scale-110' : 'scale-100'}`}
        style={{
          boxShadow: isListening ? '0 0 15px rgba(34, 197, 94, 0.5)' : 
                    isProcessing ? '0 0 15px rgba(59, 130, 246, 0.5)' : 
                    'none'
        }}
      >
        {isMuted ? (
          <MicOff className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
        ) : isListening ? (
          <Mic className="w-3 h-3 sm:w-4 sm:h-4 text-white animate-pulse" />
        ) : (
          <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
        )}
      </div>

      {/* Enhanced Visualizer Bars with smoother animation */}
      <div className="flex items-center space-x-0.5 h-8 sm:h-10 bg-gray-100/50 px-1.5 sm:px-2 rounded-lg">
        {bars.map((height, index) => (
          <div
            key={index}
            className={`w-0.5 sm:w-1 rounded-full transition-all duration-150 ${getVisualizerColor()}`}
            style={{
              height: `${Math.max(2, height * 28)}px`,
              opacity: height > 0.1 ? 0.7 + height * 0.3 : 0.3,
              transform: `scaleY(${0.8 + height * 0.2})`,
              transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        ))}
      </div>

      {/* Enhanced Status Text */}
      <div className="ml-2 sm:ml-3 text-xs sm:text-sm font-medium min-w-[60px] sm:min-w-[80px]">
        {isMuted ? (
          <span className={`${getStatusTextColor()} flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full"></span>
            Muted
          </span>
        ) : isProcessing ? (
          <span className={`${getStatusTextColor()} flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Processing...
          </span>
        ) : isListening ? (
          <span className={`${getStatusTextColor()} flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
            Listening
          </span>
        ) : (
          <span className={`${getStatusTextColor()} flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full"></span>
            Ready
          </span>
        )}
      </div>
    </div>
  );
};

export default VoiceVisualizer;