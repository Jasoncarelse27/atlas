import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  variant?: 'particles' | 'waves' | 'gradient' | 'stars';
  intensity?: 'low' | 'medium' | 'high';
  color?: string;
  secondaryColor?: string;
  className?: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'particles',
  intensity = 'medium',
  color = 'var(--primary-color, #3B82F6)',
  secondaryColor = 'var(--accent-color, #10B981)',
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameIdRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    setCanvasDimensions();
    
    // Throttled resize handler to improve performance
    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        setCanvasDimensions();
        
        // Reinitialize particles or stars when canvas size changes
        if (variant === 'particles') {
          initParticles();
        } else if (variant === 'stars') {
          initStars();
        }
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);

    // Parse colors to RGB for animations
    const parseColor = (colorStr: string) => {
      // Handle CSS variables
      if (colorStr.startsWith('var(')) {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        const varName = colorStr.match(/var\((.*?)(,|$|\))/)?.[1]?.trim();
        if (varName) {
          colorStr = computedStyle.getPropertyValue(varName).trim() || '#3B82F6';
        } else {
          colorStr = '#3B82F6'; // Fallback
        }
      }
      
      // Handle hex colors
      if (colorStr.startsWith('#')) {
        const r = parseInt(colorStr.slice(1, 3), 16);
        const g = parseInt(colorStr.slice(3, 5), 16);
        const b = parseInt(colorStr.slice(5, 7), 16);
        return { r, g, b };
      }
      
      // Handle rgb/rgba colors
      const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (rgbMatch) {
        return {
          r: parseInt(rgbMatch[1], 10),
          g: parseInt(rgbMatch[2], 10),
          b: parseInt(rgbMatch[3], 10)
        };
      }
      
      // Fallback
      return { r: 59, g: 130, b: 246 };
    };

    const primaryColor = parseColor(color);
    const secondColor = parseColor(secondaryColor);

    // Determine particle count based on intensity and screen size
    const getParticleCount = () => {
      // Base count on screen size, but cap it for performance
      const baseCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 20000));
      
      switch (intensity) {
        case 'low': return Math.floor(baseCount * 0.5);
        case 'high': return Math.floor(baseCount * 1.5);
        case 'medium':
        default: return baseCount;
      }
    };

    // Animation variables
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }
    
    interface Star {
      x: number;
      y: number;
      size: number;
      opacity: number;
      twinkle: number;
    }
    
    let particles: Particle[] = [];
    let waveOffset = 0;
    let gradientAngle = 0;
    let stars: Star[] = [];

    // Initialize particles
    const initParticles = () => {
      const particleCount = getParticleCount();
      particles = [];
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 1,
          color: Math.random() > 0.5 ? primaryColor : secondColor,
          speedX: (Math.random() - 0.5) * 0.3,
          speedY: (Math.random() - 0.5) * 0.3,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    };

    // Initialize stars
    const initStars = () => {
      const starCount = getParticleCount() * 2;
      stars = [];
      
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 0.5,
          color: Math.random() > 0.8 ? secondColor : primaryColor,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
          twinkleOffset: Math.random() * Math.PI * 2,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    };

    // Draw particles animation
    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw particles
      particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity})`;
        ctx.fill();
        
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
      });
      
      // Draw connections between nearby particles
      particles.forEach((particle, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = particle.x - p2.x;
          const dy = particle.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 80) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${0.15 * (1 - distance / 80)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });
      
      animationFrameIdRef.current = requestAnimationFrame(drawParticles);
    };

    // Draw waves animation
    const drawWaves = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const waveHeight = canvas.height / 20;
      const waveCount = 3;
      
      for (let i = 0; i < waveCount; i++) {
        const opacity = 0.1 - (i * 0.02);
        const heightOffset = i * 20;
        
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        
        for (let x = 0; x < canvas.width; x += 10) {
          const y = Math.sin(x * 0.01 + waveOffset + i) * waveHeight + canvas.height / 2 + heightOffset;
          ctx.lineTo(x, y);
        }
        
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${opacity})`);
        gradient.addColorStop(0.5, `rgba(${secondColor.r}, ${secondColor.g}, ${secondColor.b}, ${opacity})`);
        gradient.addColorStop(1, `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${opacity})`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      waveOffset += 0.02;
      animationFrameIdRef.current = requestAnimationFrame(drawWaves);
    };

    // Draw gradient animation
    const drawGradient = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.max(canvas.width, canvas.height);
      
      const gradient = ctx.createRadialGradient(
        centerX + Math.cos(gradientAngle) * radius * 0.3,
        centerY + Math.sin(gradientAngle) * radius * 0.3,
        0,
        centerX,
        centerY,
        radius
      );
      
      gradient.addColorStop(0, `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, 0.2)`);
      gradient.addColorStop(0.5, `rgba(${secondColor.r}, ${secondColor.g}, ${secondColor.b}, 0.1)`);
      gradient.addColorStop(1, `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      gradientAngle += 0.005;
      animationFrameIdRef.current = requestAnimationFrame(drawGradient);
    };

    // Draw stars animation
    const drawStars = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw stars
      stars.forEach(star => {
        const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const opacity = star.opacity * twinkle;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${opacity})`;
        ctx.fill();
        
        // Add glow effect
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${opacity * 0.3})`;
        ctx.fill();
      });
      
      animationFrameIdRef.current = requestAnimationFrame(drawStars);
    };

    // Initialize and start animation based on variant
    switch (variant) {
      case 'particles':
        initParticles();
        drawParticles();
        break;
      case 'waves':
        drawWaves();
        break;
      case 'gradient':
        drawGradient();
        break;
      case 'stars':
        initStars();
        drawStars();
        break;
      default:
        initParticles();
        drawParticles();
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      clearTimeout(resizeTimeout);
    };
  }, [variant, intensity, color, secondaryColor]);

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};

export default AnimatedBackground;