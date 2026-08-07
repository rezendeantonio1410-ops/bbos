import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: '#EBEBEB',
        black: '#0A0A0A',
        forest: { 50: '#E0EAE9', 100: '#E0EAE9', 700: '#0E191D', 800: '#0E191D', 900: '#0A0A0A', 950: '#0A0A0A' },
        coffee: { 100: '#E0EAE9', 400: '#E0EAE9', 600: '#0E191D' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], display: ['Montserrat', 'ui-sans-serif', 'system-ui'] },
      boxShadow: { card: '0 1px 2px rgba(10,10,10,.04), 0 12px 36px rgba(14,25,29,.06)' },
    },
  },
  plugins: [],
};

export default config;
