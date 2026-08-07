import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 50: '#f3f7f4', 100: '#e2ece5', 700: '#315c43', 800: '#254936', 900: '#193629', 950: '#10271d' },
        coffee: { 100: '#efe5d7', 400: '#b98754', 600: '#815832' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,39,29,.04), 0 12px 36px rgba(16,39,29,.05)' },
    },
  },
  plugins: [],
};

export default config;
