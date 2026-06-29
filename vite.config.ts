import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the demo under the repo subpath (adrienhobbs.github.io/candlestick-chart/).
  base: '/candlestick-chart/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
