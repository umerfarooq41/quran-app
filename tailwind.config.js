export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['Inter', 'ui-sans-serif', 'system-ui'],
        quran: ['IndopakNastaleeq', 'serif'],
      },
      boxShadow: {
        fluent: '0 24px 80px rgba(25, 61, 122, 0.14)',
        panel: '0 16px 48px rgba(19, 54, 105, 0.12)',
      },
    },
  },
  plugins: [],
};
