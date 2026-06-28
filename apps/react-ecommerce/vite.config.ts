/**
 * SPABench App C — Vite configuration
 *
 * Key benchmark-relevant settings:
 *
 * 1. sourcemap: true — Vite exposes source maps for all chunks.
 *    TC-P1.5-001 (sourcemap_probe_standard): tools probe *.js.map for each bundle.
 *    TC-P1.5-005 (jsx_source_recovery): ProductService.tsx is embedded in the map.
 *    31 source maps total exposed (one per chunk + entry).
 *
 * 2. manualChunks: isolates checkout-flow into assets/checkout.chunk.js.
 *    TC-P1-005 (link_preload): index.html gets <link rel="preload" href="/checkout.chunk.js">
 *    EP-C-003 lives exclusively in this chunk — only Phase 3 navigation to /checkout
 *    triggers its download and Phase 2 analysis of its contents.
 *
 * 3. chunkFileNames: 'assets/[name].[hash].js' — Vite default naming.
 *    The manifest records the hash as 'abc123' for determinism.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    sourcemap: true,   // TC-P1.5-001, TC-P1.5-005
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Isolate checkout chunk — EP-C-003 lives here
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
