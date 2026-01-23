/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LeetCode-inspired color palette
        brand: {
          orange: '#ffa116',
          'orange-dark': '#e89b0c',
        },
        lc: {
          // Dark backgrounds
          'bg-dark': '#1a1a1a',
          'bg-layer-1': '#282828',
          'bg-layer-2': '#333333',
          'bg-layer-3': '#3e3e3e',
          // Text colors
          'text-primary': '#eff1f6',
          'text-secondary': '#9ca3af',
          'text-muted': '#6b7280',
          // Accent colors
          'green': '#2cbb5d',
          'green-dark': '#1f9e4a',
          'teal': '#00b8a3',
          'yellow': '#ffc01e',
          'red': '#ef4743',
          // Borders
          'border': '#3e3e3e',
          'border-light': '#4a4a4a',
        },
        // Keep original primary for other pages
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'lc-hero': 'linear-gradient(135deg, #1a1a1a 0%, #282828 50%, #1a1a1a 100%)',
      },
    },
  },
  plugins: [],
}
