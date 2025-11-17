import React, { useEffect, useRef } from 'react';
import useThemeMode from '../hooks/useThemeMode';

const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const { isDarkMode } = useThemeMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);

    const stars: Array<{
      x: number;
      y: number;
      radius: number;
      color: string;
      speed: number;
      angle: number;
      distance: number;
      orbitRadius: number;
    }> = [];

    // Get CSS variables for dynamic theming
    const getThemeColors = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);

      // Use dark theme colors
      const backgroundColor = isDarkMode ? '#121212' : '#F9FAFB';
      const textColor = isDarkMode ? '#E5E7EB' : '#1F2937';

      return { backgroundColor, textColor }; 
    };

    const createStars = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const { textColor } = getThemeColors();
      
      stars.length = 0;
      
      for (let i = 0; i < 150; i++) {
        const orbitRadius = Math.random() * (Math.min(canvas.width, canvas.height) * 0.4) + 50;
        const angle = Math.random() * Math.PI * 2; 
        const distance = Math.random() * orbitRadius;
        
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        const radius = Math.random() * 1.2 + 0.3;
        const speed = (Math.random() * 0.0003 + 0.0001) * (Math.random() > 0.5 ? 1 : -1);
        
        const distanceRatio = distance / orbitRadius; 
        const opacity = 0.3 + (1 - distanceRatio) * 0.4;
        
        // Convert hex color to RGB for opacity manipulation
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 180, g: 180, b: 180 };
        };
        
        const rgb = hexToRgb(textColor);
        const color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.6})`;
        
        stars.push({
          x,
          y,
          radius,
          color,
          speed,
          angle,
          distance,
          orbitRadius
        });
      }
    };

    createStars();
    window.addEventListener('resize', createStars);

    const drawGalaxyCenter = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const { backgroundColor, textColor } = getThemeColors();
      
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0, 
        centerX, centerY, canvas.height * 0.3
      );
      
      // Convert hex colors to RGB for gradient
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 229, g: 231, b: 235 };
      };
      
      const textRgb = hexToRgb(textColor);
      
      gradient.addColorStop(0, `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0.05)`);
      gradient.addColorStop(0.3, `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0.02)`);
      gradient.addColorStop(1, `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0)`); 
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, canvas.height * 0.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Use dynamic background color with increased transparency
      const { backgroundColor } = getThemeColors();
      ctx.fillStyle = backgroundColor;
      ctx.globalAlpha = 0.3; // Make background more transparent
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
      
      drawGalaxyCenter();
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      stars.forEach(star => {
        star.angle += star.speed;
        
        star.x = centerX + Math.cos(star.angle) * star.distance;
        star.y = centerY + Math.sin(star.angle) * star.distance;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.fill();
        
        // Subtle glow effect
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = star.color.replace(')', ', 0.2)');
        ctx.fill();
      });
      
      requestAnimationFrame(animate);
    };

    animate();

    // Listen for theme changes and recreate stars
    const handleThemeChange = () => {
      createStars();
    };

    // Watch for CSS variable changes
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });

    return () => {
      window.removeEventListener('resize', setCanvasDimensions);
      window.removeEventListener('resize', createStars);
      observer.disconnect();
    };
  }, [isDarkMode]); // ✅ Watch for theme changes

  return (
    <canvas 
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
    />
  );
};

export default Background;