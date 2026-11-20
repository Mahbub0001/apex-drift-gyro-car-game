/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#08090C',
          card: '#12141D',
          cyan: '#00F2FE',
          purple: '#8A2BE2',
          red: '#FF0055',
          amber: '#FFB800'
        }
      },
      fontFamily: {
        racing: ['Rajdhani', 'sans-serif'],
        display: ['Chakra Petch', 'sans-serif']
      }
    },
  },
  plugins: [],
}
