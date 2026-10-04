/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 20px 45px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
