import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // En dev, /api est relayé vers Laravel (cd backend && php artisan serve).
  const api = loadEnv(mode, process.cwd(), '').API_URL || 'http://127.0.0.1:8000';
  const proxy = { '/api': { target: api, changeOrigin: true } };
  return {
  server: { proxy },
  preview: { proxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Wavify',
        short_name: 'Wavify',
        description: 'Ta musique gratuite : YouTube, SoundCloud et Audius dans une seule app.',
        lang: 'fr',
        theme_color: '#0b0a10',
        background_color: '#0b0a10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /ytimg\.com|sndcdn\.com|scdn\.co|audius|monophonic/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'artwork',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
};
});
