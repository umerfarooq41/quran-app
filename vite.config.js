import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('src/data/quranPages16') || id.includes('src/data/quranAyahs') || id.includes('src/data/surahInfo')) return 'quran-data';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: [
        'fonts/nastaleeq-font.woff2',
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-icon-512.png',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        globIgnores: ['data/audio/*.json'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => (
              url.origin === self.location.origin
              && (
                url.pathname.startsWith('/fonts/')
                || url.pathname.startsWith('/icons/')
                || url.pathname === '/data/urMaududi.json'
              )
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'quran-core-assets',
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: ({ url }) => (
              url.origin === self.location.origin
              && url.pathname.startsWith('/data/audio/')
              && url.pathname.endsWith('.json')
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'quran-audio-indexes',
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
});
