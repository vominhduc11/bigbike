import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import appConfig from '../../vite.config.js'
import previewConfig from '../vite.preview.config.ts'

export default defineConfig({
  ...appConfig,
  plugins: [
    // Kiểm hình học bằng source thật; bản production vẫn qua compiler ở npm run build.
    tailwindcss(),
    react(),
    {
      name: 'media-sidebar-test-entry',
      transformIndexHtml(html) {
        return html.replace('/src/main.jsx', '/e2e/media-sidebar/main.jsx')
      },
    },
  ],
  server: {
    host: 'localhost',
    port: 4281,
    strictPort: true,
    proxy: previewConfig.preview.proxy,
  },
})
