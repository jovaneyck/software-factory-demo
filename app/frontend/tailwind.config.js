/**
 * Design tokens. Components must use these semantic names (brand, ink, canvas, surface,
 * line, success, warning, danger) instead of raw Tailwind palettes — enforced by ESLint.
 * See src/ui/README.md.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#f0f3ff',
          100: '#e1e7ff',
          200: '#c8d2ff',
          300: '#a3b2fe',
          400: '#7c88fa',
          500: '#5d62f3',
          600: '#4a45e6',
          700: '#3d36cb',
          800: '#332fa4',
          900: '#2e2d82',
        },
        canvas: '#f6f6f9',
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f1f1f5',
          sunken: '#e9e9ef',
        },
        ink: {
          DEFAULT: '#17171f',
          muted: '#565667',
          subtle: '#8b8b9b',
          inverted: '#ffffff',
        },
        line: {
          DEFAULT: '#e6e6ec',
          strong: '#d3d3dc',
        },
        success: { DEFAULT: '#14935f', soft: '#e3f6ec' },
        warning: { DEFAULT: '#b76e00', soft: '#fdf1dc' },
        danger: { DEFAULT: '#d43d3d', soft: '#fdeaea' },
      },
      boxShadow: {
        card: '0 1px 2px rgb(23 23 31 / 0.04), 0 1px 3px rgb(23 23 31 / 0.06)',
        raised: '0 2px 4px rgb(23 23 31 / 0.04), 0 8px 24px -6px rgb(23 23 31 / 0.12)',
        overlay: '0 24px 64px -12px rgb(23 23 31 / 0.35)',
        brand: '0 6px 16px -6px rgb(74 69 230 / 0.55)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'rise-in': 'rise-in 220ms ease-out',
        'pop-in': 'pop-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1.2)',
      },
    },
  },
  plugins: [],
};
