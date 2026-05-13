/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#09090b',
          1: '#111114',
          2: '#18181c',
          3: '#222228',
          4: '#2a2a32',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          glow: '#6366f120',
          muted: '#6366f140',
        },
        status: {
          running: '#22c55e',
          exited: '#ef4444',
          idle: '#71717a',
        },
        border: {
          DEFAULT: '#1e1e24',
          subtle: '#16161a',
          hover: '#2a2a32',
        },
      },
      fontSize: {
        xxs: '0.7rem',
        xs: '0.775rem',
        sm: '0.85rem',
      },
      boxShadow: {
        glow: '0 0 20px rgba(99, 102, 241, 0.15)',
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.1)',
        panel: '0 0 40px rgba(0, 0, 0, 0.4)',
        subtle: '0 1px 3px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-sidebar': 'linear-gradient(180deg, #111114 0%, #0d0d10 100%)',
        'gradient-header': 'linear-gradient(90deg, #111114 0%, #13131a 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
