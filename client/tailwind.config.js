/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep cinematic blacks with subtle warm undertones.
        base: '#0a0a0c',
        surface: {
          900: '#111114',
          800: '#16161b',
          700: '#1d1d23',
          600: '#26262e',
          500: '#3a3a44',
        },
        // Netflix-inspired red accent palette.
        brand: {
          50:  '#ffe5e9',
          100: '#ffb3bd',
          200: '#ff8092',
          300: '#ff4d66',
          400: '#ff1a3b',
          500: '#e50914', // Netflix signature red
          600: '#b8070f',
          700: '#8a050b',
          800: '#5c0307',
          900: '#2e0204',
        },
      },
      boxShadow: {
        'brand-glow': '0 0 60px -10px rgba(229, 9, 20, 0.5)',
        'brand-glow-sm': '0 0 30px -5px rgba(229, 9, 20, 0.4)',
        'panel': '0 4px 20px -2px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulseSlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
};
