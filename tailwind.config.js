/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0e0e10',
          1: '#18181b',
          2: '#1e1e22',
          3: '#27272a',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
        },
        status: {
          running: '#22c55e',
          exited: '#ef4444',
          idle: '#71717a',
        },
      },
      fontSize: {
        xxs: '0.65rem',
      },
    },
  },
  plugins: [],
};
