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
        'adam-bg-dark': '#191A1A',
        'adam-bg-secondary-dark': '#212121',
        'adam-blue': '#00A6FF',
        'adam-text-primary': '#E5E5E5',
        'adam-text-secondary': '#949494',
        'adam-text-tertiary': '#676767',
        'adam-neutral-950': '#111111',
        'adam-neutral-900': '#171818',
        'adam-neutral-800': '#2D2D2D',
        'adam-neutral-700': '#3B3B3B',
        'adam-neutral-500': '#5A5A5A',
        'adam-neutral-400': '#676767',
        'adam-neutral-300': '#949494',
        'adam-neutral-200': '#ADADAD',
        'adam-neutral-100': '#D7D7D7',
        'adam-neutral-50': '#E5E5E5',
        'adam-neutral-10': '#F2F2F2',
        'adam-background-1': '#212121',
        'adam-background-2': '#191A1A',
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
