/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16a34a',
          600: '#0d7d3b',
          700: '#095c2b',
          800: '#063d1c',
          900: '#062326',
          950: '#031416',
        },
        slate: {
          850: '#111c2d',
          950: '#0a0f1d',
        },
        farm: {
          primary: '#062326',
          green: '#16a34a',
          darkGreen: '#062326',
          soil: '#854d0e',
          water: '#0284c7',
          sun: '#eab308',
          card: '#ffffff',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 15px rgba(6, 35, 38, 0.25)',
        'glow-sky': '0 0 15px rgba(2, 132, 199, 0.25)',
        'glow-amber': '0 0 15px rgba(234, 179, 8, 0.25)',
      }
    },
  },
  plugins: [],
}
