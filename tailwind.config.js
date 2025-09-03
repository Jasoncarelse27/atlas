import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'atlas-primary': '#B2BDA3',
        'atlas-accent': '#F4E5D9',
      },
    },
  },
  plugins: [forms],
}; 