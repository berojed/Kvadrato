/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#000000',
        'primary-foreground': '#FFFFFF',
        accent: '#FF7A00',
        'accent-foreground': '#FFFFFF',
        background: '#FFFFFF',
        foreground: '#333333',
        muted: '#F5F5F5',
        'muted-foreground': '#808080',
        border: '#D3D3D3',
        destructive: '#E53E3E',
        'destructive-foreground': '#FFFFFF',
        gray: {
          100: '#F5F5F5',
          300: '#D3D3D3',
          500: '#808080',
          700: '#4D4D4D',
          900: '#1A1A1A',
        },
      },
      fontFamily: {
        sans: ['Work Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      spacing: {
        base: '8px',
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      maxWidth: {
        container: '1280px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
