/**
 * Import brand banner images from WordPress into BigBike.
 *
 * WP stores brand banners in kd_termmeta as pwb_brand_banner (attachment ID).
 * Only 2 brands have banner data in the WP dump:
 *   - SIXS  (term_id=4428, wp-brand-4428): wide motorcycle lifestyle photo
 *   - HEVIK (term_id=6661, wp-brand-6661): same image as logo — skipped
 *
 * The migration V91 already seeds SIXS banner via SQL.
 * This script is for runtime admin API update (e.g. after reseed / data loss).
 *
 * Usage: node scripts/import-wp-brand-banners.mjs
 * Dry-run: DRY_RUN=1 node scripts/import-wp-brand-banners.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API = 'http://localhost:8080/api/v1'
const DRY_RUN = process.env.DRY_RUN === '1'

const WP_BANNERS_PATH = join(__dirname, 'wp-brand-banners.json')

// ── helpers ───────────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function apiGet(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function apiPatch(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── 1. Login ─────────────────────────────────────────────────────────────────
console.log('Logging in...')
const loginRes = await apiPost('/auth/login', {
  email: 'admin@bigbike.vn',
  password: 'admin123',
})
const token = loginRes.data?.accessToken
if (!token) throw new Error('Login failed: ' + JSON.stringify(loginRes))
console.log('  Logged in.')

// ── 2. Fetch all BigBike brands ───────────────────────────────────────────────
console.log('\nFetching BigBike brands...')
const brandsRes = await apiGet('/admin/brands?page=1&size=100', token)
const bigbikeBrands = brandsRes.data ?? []
const brandById = Object.fromEntries(bigbikeBrands.map(b => [b.id, b]))
console.log(`  Found ${bigbikeBrands.length} brands`)

// ── 3. Load WP banner data ────────────────────────────────────────────────────
let wpBanners
try {
  wpBanners = JSON.parse(readFileSync(WP_BANNERS_PATH, 'utf-8'))
} catch {
  console.error('\nERR: wp-brand-banners.json not found. Run parse-wp-brand-banners.mjs first.')
  process.exit(1)
}
console.log(`\nWP banners loaded: ${wpBanners.length} entries`)

// ── 4. Import ─────────────────────────────────────────────────────────────────
console.log(DRY_RUN ? '\n[DRY RUN — no writes]\n' : '\nImporting banners...\n')

let updated = 0, skipped = 0, missing = 0, errors = 0

for (const wp of wpBanners) {
  const brand = brandById[wp.backendId]

  if (!brand) {
    console.log(`  SKIP  ${wp.backendId} — not found in BigBike`)
    missing++
    continue
  }

  // Skip HEVIK: its banner URL is the same as its logo (images.png placeholder)
  if (!wp.bannerUrl || (wp.logoUrl && wp.bannerUrl === wp.logoUrl)) {
    console.log(`  SKIP  ${brand.slug.padEnd(20)} — banner = logo (no distinct banner)`)
    skipped++
    continue
  }

  if (brand.bannerImage?.url === wp.bannerUrl) {
    console.log(`  SKIP  ${brand.slug.padEnd(20)} — already has this banner URL`)
    skipped++
    continue
  }

  const payload = {
    slug: brand.slug,
    name: brand.name,
    description: brand.description ?? '',
    visible: brand.isVisible !== false,
    banner: { url: wp.bannerUrl, alt: brand.name },
  }

  if (DRY_RUN) {
    console.log(`  DRY   ${brand.slug.padEnd(20)} → ${wp.bannerUrl}`)
    updated++
    continue
  }

  try {
    await apiPatch(`/admin/brands/${brand.id}`, token, payload)
    console.log(`  OK    ${brand.slug.padEnd(20)} → ${wp.bannerUrl}`)
    updated++
  } catch (err) {
    console.error(`  ERR   ${brand.slug.padEnd(20)} — ${err.message}`)
    errors++
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════')
console.log(DRY_RUN ? 'DRY RUN SUMMARY' : 'IMPORT SUMMARY')
console.log(`  Updated:             ${updated}`)
console.log(`  Skipped:             ${skipped}`)
console.log(`  Not found in BigBike: ${missing}`)
if (errors) console.log(`  Errors:              ${errors}`)
console.log('\nDone.')
