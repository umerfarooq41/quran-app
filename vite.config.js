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
  server: {
    proxy: {
      '/api/qf': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
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
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        globIgnores: [
          'data/audio/*.json',
          'data/audio/full/**/surah.json',
          'data/audio/full/**/segments.json',
          'data/audio/full/**/*.mp3',
          'data/translations/wbw-translation-en.json',
        ],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => (
              url.origin === self.location.origin
              && url.pathname === '/data/translations/wbw-translation-en.json'
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'word-by-word-english',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
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
              && url.pathname.startsWith('/data/audio/full/')
              && url.pathname.endsWith('/surah.json')
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'full-surah-metadata',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90,
                purgeOnQuotaError: true,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) => (
              url.origin === self.location.origin
              && url.pathname.startsWith('/data/audio/full/')
              && url.pathname.endsWith('/segments.json')
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'full-surah-segments',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90,
                purgeOnQuotaError: true,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) => (
              url.origin === self.location.origin
              && url.pathname.startsWith('/data/audio/')
              && !url.pathname.startsWith('/data/audio/full/')
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
          // Full-Surah MP3s stay network-streamed. The player relies on byte-range
          // responses for seeking, and runtime caching partial responses would
          // require a separate, user-initiated full-download workflow.
          {
            urlPattern: ({ url }) => (
              url.origin === self.location.origin
              && url.pathname.startsWith('/api/qf')
            ),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'quran-foundation-content',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
