import { defineConfig } from 'vite'

/**
 * Dedicated `vite preview` config for the e2e suite.
 *
 * The committed vite.config.js only declares a DEV-server proxy; `vite preview`
 * needs its own `preview.proxy`. This file mirrors the container's nginx.conf so
 * a local production build (dist/) talks to the same real backend + MinIO that
 * the deployed admin uses. Kept here (not in vite.config.js) to leave the app's
 * build config untouched.
 *
 * Origin allow-list: the backend rejects unknown Origins server-side with 403.
 * The preview origin (127.0.0.1:4280) is not on the list, so we rewrite the
 * Origin/Referer on proxied API + WS requests to an allowed production value.
 * Browser→preview calls are same-origin (no browser CORS), so this only affects
 * what the backend's server-side filter sees — faithfully reproducing prod,
 * where the admin is genuinely served from an allowed origin.
 *
 * Default matches this VPS's current BIGBIKE_CORS_ALLOWED_ORIGINS (root .env) —
 * public IP only, no `localhost` entry. Override with E2E_BACKEND_ORIGIN if that
 * allow-list ever changes (e.g. a different host/IP).
 *
 * Targets are host-mapped Docker ports: backend 8080, MinIO 9000.
 * `/media-proxy` is listed before `/media` so the regex contexts don't overlap.
 */
const BACKEND = 'http://localhost:8080'
const MINIO = 'http://localhost:9000'
const ALLOWED_ORIGIN = process.env.E2E_BACKEND_ORIGIN || 'http://103.1.236.148:4000'

function spoofOrigin(proxy: any) {
  const set = (req: any) => {
    req.setHeader('origin', ALLOWED_ORIGIN)
    req.setHeader('referer', `${ALLOWED_ORIGIN}/`)
  }
  proxy.on('proxyReq', set)
  proxy.on('proxyReqWs', set)
}

export default defineConfig({
  build: { outDir: 'dist' },
  preview: {
    port: 4280,
    strictPort: true,
    proxy: {
      '^/api': { target: BACKEND, changeOrigin: true, configure: spoofOrigin },
      '^/ws': { target: BACKEND, changeOrigin: true, ws: true, configure: spoofOrigin },
      '^/media-proxy': {
        target: MINIO,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/media-proxy/, '/bigbike-media'),
      },
      '^/media/': {
        target: MINIO,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/media/, '/bigbike-media'),
      },
    },
  },
})
