import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, USE_LOCAL_PREVIEW, PREVIEW_PORT } from './e2e/utils/env'
import { DESKTOP_VIEWPORT } from './e2e/utils/viewports'

/**
 * bigbike-admin e2e / UI-quality config.
 *
 * Target: a LOCAL production preview (vite build → vite preview, port 4280) by
 * default, or the live deployment when E2E_BASE_URL is set. Chromium only —
 * the admin is an internal tool with a Chromium-class browser requirement.
 *
 * The 8-viewport matrix lives in e2e/utils/viewports.ts and is exercised by
 * specs that set `test.use({ viewport })` per block, keeping run time bounded
 * (heavy specs run once at desktop; responsive.spec sweeps all 8).
 */
export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './e2e/.artifacts',
  snapshotDir: './e2e/__screenshots__',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Single worker: refresh-token is per-IP rate-limited (30/min) and the access
  // token is in-memory, so a serial run keeps us safely under the limit.
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
    ['json', { outputFile: 'e2e/report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height } },
    },
  ],
  webServer: USE_LOCAL_PREVIEW
    ? {
        // Self-sufficient: builds then serves dist. If a preview is already up
        // on PREVIEW_PORT (e.g. started manually for the fix→verify loop), it
        // is reused and this command never runs.
        // Build faithfully to the container (same VITE_* build args as the
        // Dockerfile) so the WS client uses same-origin /ws and media URLs
        // resolve. Reused if a preview is already serving PREVIEW_PORT.
        command: `VITE_ADMIN_API_BASE=/api/v1 VITE_MINIO_INTERNAL_ORIGIN=http://minio:9000 npm run build && npx vite preview --config e2e/vite.preview.config.ts`,
        url: `http://127.0.0.1:${PREVIEW_PORT}/`,
        timeout: 180_000,
        reuseExistingServer: true,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
})
