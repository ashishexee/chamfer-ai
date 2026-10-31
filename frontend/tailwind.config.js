/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif', 'system-ui'],
        title: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        'adam-bg-dark': '#171717',
        'adam-bg-secondary-dark': '#1C1C1C',
        // Brand accent — Rare UI orange on black.
        'adam-accent': '#F9B584',
        // Legacy alias so a straggler class can never render blue.
        'adam-blue': '#F9B584',
        'adam-text-primary': '#F5F5F5',
        'adam-text-secondary': '#A3A3A3',
        'adam-text-tertiary': '#6E6E6E',
        'adam-neutral-950': '#171717',
        'adam-neutral-900': '#1C1C1C',
        'adam-neutral-800': '#1F1F1F',
        'adam-neutral-700': '#2A2A2A',
        'adam-neutral-500': '#555555',
        'adam-neutral-400': '#6E6E6E',
        'adam-neutral-300': '#A3A3A3',
        'adam-neutral-200': '#C2C2C2',
        'adam-neutral-100': '#E0E0E0',
        'adam-neutral-50': '#F2F2F2',
        'adam-neutral-10': '#FAFAFA',
        'adam-background-1': '#1C1C1C',
        'adam-background-2': '#1A1A1A',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
