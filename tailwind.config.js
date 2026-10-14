/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        pearl: 'var(--pearl)',
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        brand: { DEFAULT: 'var(--brand)', strong: 'var(--brand-strong)', ink: 'var(--brand-ink)', soft: 'var(--brand-soft)' },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        bad: { DEFAULT: 'var(--bad)', soft: 'var(--bad-soft)' },
        line: 'var(--line)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { panel: '24px', ctl: '14px' },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        lift: 'var(--shadow-lift)',
      },
      transitionTimingFunction: { soft: 'cubic-bezier(.22,.8,.3,1)' },
    },
  },
  plugins: [],
};
