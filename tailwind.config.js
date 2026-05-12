/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          black: '#0a0a0a',
          darker: '#111111',
          dark: '#1a1a1a',
          gray: {
            900: '#1f1f1f',
            800: '#2a2a2a',
            700: '#3a3a3a',
            600: '#4a4a4a',
            500: '#6a6a6a',
            400: '#8a8a8a',
            300: '#aaaaaa',
            200: '#cccccc',
            100: '#e5e5e5',
          },
          white: '#f5f5f5',
          accent: '#00d4ff',
          'accent-dim': '#0099b8',
          green: '#00ff88',
          'green-dim': '#00b860',
          red: '#ff3366',
          'red-dim': '#b82448',
          yellow: '#ffcc00',
          'yellow-dim': '#b89900',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['13px', { lineHeight: '1.4' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['15px', { lineHeight: '1.6' }],
        'lg': ['18px', { lineHeight: '1.5' }],
        'xl': ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.3' }],
        '3xl': ['30px', { lineHeight: '1.2' }],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        'glow-radial': 'radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid-size': '40px 40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan-line': 'scanLine 4s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0,212,255,0.2), 0 0 10px rgba(0,212,255,0.1)' },
          '100%': { boxShadow: '0 0 10px rgba(0,212,255,0.4), 0 0 20px rgba(0,212,255,0.2)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
