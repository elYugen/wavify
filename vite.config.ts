import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
// @ts-expect-error module JS sans types
import { handleApi } from './server/api.js';

// Monte le backend /api/* directement dans le serveur de dev Vite.
function apiPlugin(): Plugin {
  const mount = (server: { middlewares: { use: Function } }) => {
    server.middlewares.use(async (req: any, res: any, next: () => void) => {
      if (!req.url?.startsWith('/api/')) return next();
      const u = new URL(req.url, 'http://localhost');
      const out = await handleApi(u.pathname, u.searchParams);
      res.statusCode = out.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(out.json));
    });
  };
  return { name: 'wavify-api', configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  // Rend les variables du fichier .env (SPOTIFY_CLIENT_ID…) visibles par le backend.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
  plugins: [
    react(),
    tailwindcss(),
    apiPlugin(),
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
