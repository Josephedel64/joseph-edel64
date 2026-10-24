export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#e7ecff',
          300: '#9db7ff',
          500: '#5a71ff',
          600: '#3d56e6',
          700: '#2439b4'
        }
      },
      boxShadow: {
        soft: '0 20px 45px rgba(35, 57, 120, 0.12)'
      }
    }
  },
  plugins: []
};
