import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Atlas Professional Color Palette
        'atlas-sage': '#D3DCAB',      // Primary: Main CTAs, highlights
        'atlas-sand': '#CEC1B8',      // Secondary: Cards, backgrounds
        'atlas-pearl': '#F4E8E1',     // Background: Lightest surfaces
        'atlas-peach': '#F3D3B8',     // Accent: Warm highlights, hover states
        'atlas-stone': '#978671',     // Tertiary: Muted elements
        
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