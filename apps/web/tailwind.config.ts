import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bfd2ff',
          300: '#93b3ff',
          400: '#6189ff',
          500: '#3b6bf3',
          600: '#2954dd',
          700: '#2143b6',
          800: '#1f3a91',
          900: '#1d3673',
        },
        ink: {
          900: '#0b0d12',
          700: '#2b2f3a',
          500: '#5b6273',
          300: '#a0a6b4',
          100: '#e7e9ee',
        },
      },
      maxWidth: {
        prose: '70ch',
      },
    },
  },
  plugins: [],
};

export default config;
