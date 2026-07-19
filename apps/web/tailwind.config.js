const { join } = require('path');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx,mdx}'),
    join(__dirname, '../../libs/web-shared/src/**/*.{js,ts,jsx,tsx,mdx}'),
  ],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eefdf3', 100: '#d6f9e2', 500: '#16a34a', 600: '#15803d', 700: '#166534' },
      },
    },
  },
  plugins: [],
};
