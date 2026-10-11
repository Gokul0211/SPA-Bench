import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {

        manualChunks: {
          'checkout': [
            './src/micro-apps/checkout-flow/services/CheckoutService.ts',
          ],
        },
        chunkFileNames: 'assets/[name].chunk.js',
        entryFileNames: 'assets/index.[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },

  server: {
    port: 3003,
  },
});
