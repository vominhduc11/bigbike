/**
 * Central env/config for the e2e suite.
 *
 * Defaults target a LOCAL production preview (vite build + vite preview) on
 * localhost:4280 so fixes can be rebuilt and re-verified against the same
 * artifact we edit. Point E2E_BASE_URL at http://103.1.236.148:4000 to audit
 * the live (nginx-served) deployment instead.
 *
 * Credentials default to the SUPER_ADMIN account supplied for this engagement
 * (permissions: ["*"], so every route is reachable). Override via env to keep
 * secrets out of CI logs.
 */
export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4280'

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@bigbike.vn'
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123'

export const API_BASE = '/api/v1'

/** Preview server port — must match e2e/vite.preview.config.ts. */
export const PREVIEW_PORT = 4280

/** When pointing at a remote/live deployment, skip the managed preview server. */
export const USE_LOCAL_PREVIEW =
  !process.env.E2E_NO_WEBSERVER && BASE_URL.includes(`:${PREVIEW_PORT}`)
