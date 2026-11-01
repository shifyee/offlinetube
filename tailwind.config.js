/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f0f',
        surface: '#1f1f1f',
        'surface-2': '#272727',
        'surface-3': '#3f3f3f',
        text: '#f1f1f1',
        muted: '#aaaaaa',
        accent: 'var(--accent, #ff0033)', // <--- THE FIX: Uses dynamic CSS var
        sidebar: '#0f0f0f'
      }
    },
  },
  plugins: [],
}
