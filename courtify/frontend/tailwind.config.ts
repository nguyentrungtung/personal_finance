import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — COURTIFY dark theme
        brand: {
          green: '#22c55e',
          'green-muted': '#16a34a',
          amber: '#f59e0b',
          red: '#ef4444',
          blue: '#3b82f6',
        },
        surface: {
          DEFAULT: '#0f1117',
          card: '#1a1d27',
          border: '#2a2d3a',
          hover: '#22253a',
          input: '#1f2235',
        },
        text: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        'hero': ['2.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'card-value': ['1.5rem', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
