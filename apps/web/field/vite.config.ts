import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'PubliPulse Field',
        short_name: 'PubliPulse',
        description: 'Offline-first public health field capture for signals, actions and outcomes.',
        theme_color: '#0f3d2e',
        background_color: '#0b1a14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // App shell only. Never cache API responses that contain operational data.
        navigateFallback: '/index.html',
        runtimeCaching: []
      }
    })
  ],
  server: {
    port: 5174,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        // Browsers send Origin on same-origin POST/PATCH; the API only accepts its configured WEB_ORIGIN.
        // This is a dev-only server-to-server hop, so drop the header instead of loosening API CORS.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
        }
      }
    }
  }
});
