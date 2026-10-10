/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF9F6', // Off-white, paper-like
        surface: '#F0EBE1', // Muted beige
        primary: '#6B705C', // Muted olive green
        secondary: '#A5A58D', // Lighter olive
        text: '#3F4238', // Dark greyish green
        muted: '#B7B7A4',
      }
    },
  },
  plugins: [],
}
