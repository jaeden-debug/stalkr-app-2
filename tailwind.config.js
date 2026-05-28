/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand palette - swap these for rebranding
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Tactical dark UI
        tactical: {
          bg: '#0a0a0f',
          surface: '#12121a',
          card: '#1a1a24',
          border: '#2a2a3a',
          borderLight: '#3a3a4e',
          muted: '#4a4a60',
          text: '#e8e8f0',
          textMuted: '#8888aa',
          textDim: '#5555770',
        },
        // Status colors
        status: {
          live: '#22c55e',
          stale: '#f59e0b',
          offline: '#6b7280',
          paused: '#8b5cf6',
          danger: '#ef4444',
          warning: '#f59e0b',
          safe: '#22c55e',
          sos: '#ef4444',
          rally: '#3b82f6',
        },
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
