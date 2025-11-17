import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class', // Enable class-based dark mode (required for useThemeMode)
  theme: {
    extend: {
      colors: {
        // Atlas Professional Color Palette
        'atlas-sage': '#D3DCAB',      // Primary: Main CTAs, highlights
        'atlas-sand': '#CEC1B8',      // Secondary: Cards, backgrounds
        'atlas-pearl': '#F9F6F3',     // Background: Main background (restored original)
        'atlas-peach': '#F3D3B8',     // Accent: Warm highlights, hover states
        'atlas-stone': '#978671',     // Tertiary: Muted elements
        
        // Atlas UI Colors (from actual usage)
        'atlas-bg': '#F9F6F3',        // Main background (same as pearl)
        'atlas-border': '#E8DDD2',     // Borders, dividers
        'atlas-text-dark': '#3B3632',  // Dark text
        'atlas-text-medium': '#5A524A', // Medium text
        'atlas-text-muted': '#8B7E74',  // Muted text
        'atlas-button': '#F0E6DC',      // Button backgrounds
        'atlas-button-hover': '#E8DDD2', // Button hover states
        'atlas-accent-1': '#C8956A',     // Accent color 1
        'atlas-accent-2': '#CF9A96',     // Accent color 2
        'atlas-accent-3': '#A67571',     // Accent color 3
        'atlas-gradient-start': '#B2BDA3', // Gradient start
        'atlas-gradient-end': '#F4E5D9',   // Gradient end
        
        // Semantic Colors (Accessibility)
        'atlas-success': '#A7C080',   // Muted sage green
        'atlas-warning': '#E8C88E',   // Warm gold
        'atlas-error': '#D89090',     // Muted rose
        
        // Tier-Specific Colors
        'atlas-tier-free': '#CEC1B8',    // SAND
        'atlas-tier-core': '#D3DCAB',    // SAGE
        'atlas-tier-studio': '#978671',  // STONE
        
        // Legacy support (will be deprecated)
        'atlas-primary': '#D3DCAB',
        'atlas-accent': '#F3D3B8',
      },
    },
  },
  plugins: [forms],
}; 