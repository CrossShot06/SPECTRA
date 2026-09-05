/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        spectra: {
          bg:      '#06080e',
          surface: '#0b0f19',
          card:    '#101623',
          border:  '#1b2436',
          'border-bright': '#222f47',
          slate:   '#64748b',
          emerald: '#10b981',
          amber:   '#f59e0b',
          crimson: '#ef4444',
        },
      },
      fontFamily: {
        sans:  ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline':   'scanline 8s linear infinite',
        'risk-flash': 'riskFlash 1s ease-in-out infinite',
      },
      keyframes: {
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        riskFlash: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
