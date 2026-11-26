/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pit: {
          void: '#090A0D',
          panel: '#12141A',
          hairline: '#252A36',
          ivory: '#F4F5F7',
          cyan: '#00E5FF',
          red: '#FF3B30',
          amber: '#F5A623'
        },
        cyber: {
          dark: '#090A0D',
          card: '#12141A',
          cyan: '#00E5FF',
          purple: '#8A2BE2',
          red: '#FF3B30',
          amber: '#F5A623'
        }
      },
      fontFamily: {
        racing: ['Rajdhani', 'sans-serif'],
        display: ['Chakra Petch', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    },
  },
  plugins: [],
}
