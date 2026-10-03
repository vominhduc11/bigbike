import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import baseConfig from '../../playwright.config'

export default defineConfig({
  ...baseConfig,
  testDir: '../specs',
  testMatch: 'media-folder-sidebar.spec.ts',
  outputDir: '../.artifacts/media-folder-sidebar',
  snapshotDir: '../__screenshots__',
  retries: 0,
  use: { ...baseConfig.use, baseURL: 'http://localhost:4281', hasTouch: true, video: 'off' },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: fileURLToPath(new URL('../report/media-folder-sidebar', import.meta.url)),
        open: 'never',
      },
    ],
    [
      'json',
      {
        outputFile: fileURLToPath(
          new URL('../report/media-folder-sidebar/results.json', import.meta.url),
        ),
      },
    ],
  ],
  projects: [{ name: 'chromium' }],
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'npx vite --config e2e/media-sidebar/vite.config.mjs',
    url: 'http://localhost:4281/',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_ADMIN_API_BASE: '/api/v1' },
  },
})
