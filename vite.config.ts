import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // `npm run build:demo` makes one self-contained HTML file (hash routes, no service worker) for sharing a demo link.
  const single = env.VITE_HASH_ROUTER === 'true';
  // Sub-folder hosting (e.g. GitHub Pages: /nd-fitness-test/). Defaults to the site root.
  const base = (env.VITE_BASE || '/').replace(/\/?$/, '/');
  return {
    base,
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png', 'push-sw.js'],
            manifest: {
              name: 'Namdhari Fitness Connect',
              short_name: 'NF Connect',
              description: 'Community fitness challenges powered by your Strava activities.',
              start_url: base,
              scope: base,
              display: 'standalone',
              orientation: 'portrait',
              id: base,
              categories: ['health', 'fitness', 'lifestyle'],
              display_override: ['standalone'],
              background_color: '#F3F4F6',
              theme_color: '#F3F4F6',
              // Long-press the app icon (Android) for these quick actions.
              shortcuts: [
                { name: 'Log today', short_name: 'Log today', url: base, icons: [{ src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
                { name: 'Add a Strava activity', short_name: 'Add Strava', url: base + 'activity?add=1', icons: [{ src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
                { name: 'Challenges', short_name: 'Challenges', url: base + 'challenges', icons: [{ src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
              ],
              icons: [
                { src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: base + 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: { navigateFallback: base + 'index.html', navigateFallbackDenylist: [/^\/functions\//], importScripts: ['push-sw.js'] },
          }),
    ],
    resolve: single ? { alias: { 'virtual:pwa-register': '/src/lib/pwa-stub.ts' } } : undefined,
    build: single ? { outDir: 'dist-demo', emptyOutDir: true } : undefined,
    server: { port: 5173 },
  };
});
