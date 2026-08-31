import path from 'path'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // ANALYZE=1 npm run analyze — opens dist/stats.html, a treemap of what's in each chunk.
    process.env.ANALYZE &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    // Vendor chunk: react/react-dom/react-query/i18next/... rarely change between deploys,
    // but without this they were bundled into the same chunk as the app shell — every
    // deploy invalidated the browser's cache for vendor code too, even when only app code
    // changed. Rolldown (this project's bundler) uses output.codeSplitting.groups instead
    // of classic Rollup manualChunks — see https://rolldown.rs/in-depth/manual-code-splitting.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-redux|redux|redux-thunk|@reduxjs|@tanstack)[\\/]/,
            },
            {
              name: 'vendor-ui',
              test: /node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/,
            },
            {
              name: 'vendor-dnd',
              test: /node_modules[\\/](@dnd-kit)[\\/]/,
            },
            // Rich-text and chart dependencies only belong to lazy screens. If
            // either is admitted to the catch-all vendor group, Vite preloads
            // it with the login shell despite its dynamic import.
            {
              name: 'vendor',
              test: /node_modules[\\/](?!(?:@tiptap|prosemirror-[^\\/]+|orderedmap|linkifyjs|rope-sequence|w3c-keyname|fast-equals|zod|dompurify|es-toolkit|immer|decimal\.js-light|recharts|d3-[^\\/]+|internmap|victory-vendor|eventemitter3|react-is|tiny-invariant|use-callback-ref|use-sidecar|detect-node-es)[\\/])/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 4000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { origin: 'http://localhost:4000' },
      },
      '/media-proxy': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media-proxy/, '/bigbike-media'),
      },
      '/media': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media/, '/bigbike-media'),
      },
    },
  },
})
