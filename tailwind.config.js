/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./extension/**/*.{html,ts,tsx}",
    "./popup/**/*.{html,ts,tsx}",
    "./options/**/*.{html,ts,tsx}",
    "./blocked/**/*.{html,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        shield: {
          green: '#10b981',
          red: '#ef4444',
          amber: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}

