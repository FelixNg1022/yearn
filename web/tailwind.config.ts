import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F0',
        'honey-mid': '#FFB700',
        'honey-deep': '#FECE00',
        marigold: '#FF7301',
        'marigold-hi': '#D46700',
        stem: '#779357',
        ink: '#2A1810',
      },
      fontFamily: {
        display: ['"Instrument Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
