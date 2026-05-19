import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { qfRequest } from './server/qf-core.mjs';

function qfProxyPlugin() {
  return {
    name: 'qf-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/qf', async (req, res) => {
        try {
          const upstream = await qfRequest(req.url || '/');
          res.statusCode = upstream.status;
          res.setHeader('content-type', upstream.contentType);
          res.end(upstream.body);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

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
    qfProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/nastaleeq-font.woff2'],
      manifest: {
        name: "Qur'an Reader",
        short_name: "Qur'an",
        description: "A local-first 16-line Indopak Qur'an reader.",
        theme_color: '#f8fbff',
        background_color: '#f8fbff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/quranPages16') || url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'quran-core-assets' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/qf'),
            handler: 'NetworkFirst',
            options: { cacheName: 'quran-foundation-api', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
});
