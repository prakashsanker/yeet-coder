/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        'mono': ['"SF Mono"', 'Monaco', 'Inconsolata', '"Roboto Mono"', 'monospace'],
      },
      colors: {
        // Warm peach/cream color palette (SystemDesign.AI style)
        warm: {
          'bg': '#FFF9F2',
          'bg-pink': '#FFEDE5',
          'bg-cream': '#FEF7F0',
          'section': 'rgba(255, 244, 232, 0.6)',
          // Feature card accents
          'card-purple': '#F9E8FA',
          'card-blue': '#E4EDF8',
          'card-orange': '#FEEFDC',
          'card-pink': '#FCC9C7',
          'card-green': '#b8d1ba',
          'card-gray': '#E9E1E1',
        },
        // Accent colors for icons/text
        accent: {
          'purple': '#987D9C',
          'blue': '#768597',
          'orange': '#BCA182',
        },
        // Text colors
        landing: {
          'primary': '#232323',
          'secondary': '#353535',
          'muted': '#666666',
        },
        // Professional color palette
        brand: {
          indigo: '#4f46e5',
          'indigo-dark': '#4338ca',
        },
        // Light theme for marketing pages
        marketing: {
          'bg': '#ffffff',
          'bg-subtle': '#f8fafc',
          'bg-muted': '#f1f5f9',
          'text': '#0f172a',
          'text-secondary': '#475569',
          'text-muted': '#94a3b8',
          'border': '#e2e8f0',
          'border-hover': '#cbd5e1',
        },
        // Keep lc colors for dashboard/app
        lc: {
          'bg-dark': '#0f1117',
          'bg-layer-1': '#1a1d24',
          'bg-layer-2': '#252830',
          'bg-layer-3': '#2f333d',
          'text-primary': '#f1f5f9',
          'text-secondary': '#94a3b8',
          'text-muted': '#64748b',
          'green': '#0ea5e9',
          'green-dark': '#0284c7',
          'teal': '#06b6d4',
          'yellow': '#f59e0b',
          'red': '#f97316',
          'border': '#2e3340',
          'border-hover': '#3b4252',
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
        'gradient-peach': 'linear-gradient(180deg, #FFE5DB 0%, #FFF9F5 50%, #FEF7F0 100%)',
        'gradient-hero-warm': 'linear-gradient(180deg, rgba(252, 202, 199, 1) 0%, rgba(253, 215, 197, 0.8) 25%, rgba(254, 241, 229, 0.6) 50%, rgba(255, 250, 243, 0.8) 75%, rgba(252, 202, 199, 1) 100%)',
        'gradient-cta': 'linear-gradient(180deg, rgba(252, 202, 199, 1) 0%, rgba(253, 215, 197, 0.8) 50%, rgba(255, 250, 243, 0.9) 100%)',
      },
      keyframes: {
        wave: {
          '0%, 100%': { height: '10px' },
          '50%': { height: '35px' },
        },
        voicePulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.3' },
          '50%': { transform: 'scale(1.3)', opacity: '0' },
        },
      },
      animation: {
        'wave': 'wave 1s ease-in-out infinite',
        'voice-pulse': 'voicePulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
