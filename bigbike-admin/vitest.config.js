import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Cấu hình test riêng (tách khỏi vite.config build). Chỉ cần react + alias '@' để
// unit-test logic thuần và component nhẹ; không nạp tailwind/babel-compiler ở test.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
  },
})
