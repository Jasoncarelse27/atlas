// Central design tokens for Atlas (web-only React/Vite)
// Maps to Tailwind config and CSS variables for consistency

export const colors = {
  // Primary Atlas Brand Colors
  brand: '#B2BDA3',           // Atlas brand (sage gradient start)
  accent: '#F4E5D9',          // Atlas accent (pearl gradient end)
  
  // Core Palette (matching tailwind.config.js)
  sage: '#D3DCAB',            // Primary: Main CTAs, highlights
  sand: '#CEC1B8',            // Secondary: Cards, backgrounds
  pearl: '#F9F6F3',           // Background: Main background
  peach: '#F3D3B8',            // Accent: Warm highlights, hover states
  stone: '#978671',            // Tertiary: Muted elements
  
  // UI Colors (from actual usage)
  bg: '#F9F6F3',              // Main background (same as pearl)
  surface: '#FFFFFF',         // Surface/white
  border: '#E8DDD2',          // Borders, dividers
  'border-sand': '#CEC1B8',   // Sand-colored borders
  
  // Text Colors
  text: {
    dark: '#3B3632',          // Dark text
    medium: '#5A524A',        // Medium text
    muted: '#8B7E74',         // Muted text
    primary: '#222222',        // Primary text
    secondary: '#4A4A4A',      // Secondary text
    subtle: '#6B7280',        // Subtle text
  },
  
  // Button Colors
  button: '#F0E6DC',          // Button backgrounds
  'button-hover': '#E8DDD2',  // Button hover states
  
  // Accent Colors
  accent1: '#C8956A',
  accent2: '#CF9A96',
  accent3: '#A67571',
  
  // Gradient Colors
  'gradient-start': '#B2BDA3', // Gradient start
  'gradient-end': '#F4E5D9',   // Gradient end
  
  // Semantic Colors (Accessibility)
  success: '#A7C080',         // Muted sage green
  warning: '#E8C88E',         // Warm gold
  error: '#D89090',           // Muted rose
  
  // Tier-Specific Colors
  'tier-free': '#CEC1B8',     // SAND
  'tier-core': '#D3DCAB',     // SAGE
  'tier-studio': '#978671',   // STONE
  
  // Legacy/Common
  white: '#FFFFFF',
  black: '#000000',
};

export const radii = {
  sm: '0.375rem',    // 6px
  md: '0.5rem',      // 8px
  lg: '0.75rem',     // 12px
  xl: '1rem',        // 16px
  '2xl': '1.25rem',  // 20px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

export const spacing = {
  xs: '0.25rem',     // 4px
  sm: '0.5rem',      // 8px
  md: '0.75rem',     // 12px
  lg: '1rem',        // 16px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '2rem',     // 32px
  '4xl': '2.5rem',   // 40px
};

export const typography = {
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Safe area insets for mobile (iOS notch, Android navigation)
export const safeAreas = {
  top: 'env(safe-area-inset-top, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
};

// Export all tokens as a single object for convenience
export const theme = {
  colors,
  radii,
  spacing,
  typography,
  safeAreas,
};

export default theme;














