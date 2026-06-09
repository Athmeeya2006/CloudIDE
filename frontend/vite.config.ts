import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('monaco-editor')) return 'monaco';
          if (id.includes('@xterm')) return 'xterm';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
});
