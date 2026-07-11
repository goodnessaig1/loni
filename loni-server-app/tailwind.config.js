/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './app/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        cal: ['CalSans'],
        helixa: ['Helixa-Regular'],
        'helixa-light': ['Helixa-Light'],
        'helixa-bold': ['Helixa-Bold'],
        'helixa-black': ['Helixa-Black'],
      },
      colors: {
        primary: {
          DEFAULT: '#3498db',
          dark: '#2980b9',
        },
        secondary: {
          DEFAULT: '#2ecc71',
          dark: '#27ae60',
        },
        accent: '#e74c3c',
        background: '#f8f9fa',
        surface: '#ffffff',
      },
    },
  },
  plugins: [],
};
