/**
 * Import brand logos from WordPress into BigBike.
 *
 * How it works:
 *  1. Login to BigBike admin API to get a token
 *  2. Fetch all current BigBike brands (IDs are "wp-brand-{termId}")
 *  3. Read WP logo data extracted by parse-wp-brands.mjs
 *  4. PATCH each brand that has a logo URL in WP
 *
 * Usage: node scripts/import-wp-brand-logos.mjs
 * Dry-run (no writes): DRY_RUN=1 node scripts/import-wp-brand-logos.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API = 'http://localhost:8080/api/v1'
const DRY_RUN = process.env.DRY_RUN === '1'
const WP_UPLOADS_PREFIX = 'https://bigbike.vn/wp-content/uploads/'
const MINIO_UPLOADS_PREFIX = 'http://localhost:9000/bigbike-media/wp-uploads/'

function toMinioUrl(wpUrl) {
  if (!wpUrl?.startsWith(WP_UPLOADS_PREFIX)) return wpUrl
  return MINIO_UPLOADS_PREFIX + wpUrl.slice(WP_UPLOADS_PREFIX.length)
}

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
console.log(`  Found ${bigbikeBrands.length} brands in BigBike`)

// Build map: termId → brand (from IDs like "wp-brand-363")
const termIdToBrand = {}
for (const b of bigbikeBrands) {
  const m = b.id?.match(/^wp-brand-(\d+)$/)
  if (m) termIdToBrand[m[1]] = b
}
console.log(`  Mapped ${Object.keys(termIdToBrand).length} brands with wp-brand IDs`)

// ── 3. Load WP logos ──────────────────────────────────────────────────────────
const logosPath = join(__dirname, 'wp-brands-logos.json')
const wpLogos = JSON.parse(readFileSync(logosPath, 'utf-8'))
const wpWithLogo = wpLogos.filter(b => b.logoUrl)
console.log(`\nWP logos loaded: ${wpWithLogo.length} brands with logo URL`)

// ── 4. Import ─────────────────────────────────────────────────────────────────
console.log(DRY_RUN ? '\n[DRY RUN — no writes]\n' : '\nImporting logos...\n')

let updated = 0, skipped = 0, missing = 0, errors = 0

for (const wp of wpWithLogo) {
  const termId = wp._termId
  const brand = termIdToBrand[termId]

  if (!brand) {
    console.log(`  SKIP  termId=${termId} — no BigBike brand with id "wp-brand-${termId}"`)
    missing++
    continue
  }

  if (brand.logo?.url) {
    console.log(`  SKIP  ${brand.slug.padEnd(20)} — already has logo`)
    skipped++
    continue
  }

  const payload = {
    slug: brand.slug,
    name: brand.name,
    description: brand.description ?? '',
    visible: brand.isVisible !== false,
    logo: { url: toMinioUrl(wp.logoUrl), alt: brand.name },
  }

  if (DRY_RUN) {
    console.log(`  DRY   ${brand.slug.padEnd(20)} → ${toMinioUrl(wp.logoUrl)}`)
    updated++
    continue
  }

  try {
    await apiPatch(`/admin/brands/${brand.id}`, token, payload)
    console.log(`  OK    ${brand.slug.padEnd(20)} → ${toMinioUrl(wp.logoUrl)}`)
    updated++
  } catch (err) {
    console.error(`  ERR   ${brand.slug.padEnd(20)} — ${err.message}`)
    errors++
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════`)
console.log(DRY_RUN ? 'DRY RUN SUMMARY' : 'IMPORT SUMMARY')
console.log(`  Updated:  ${updated}`)
console.log(`  Skipped (already has logo): ${skipped}`)
console.log(`  Not found in BigBike:       ${missing}`)
if (errors) console.log(`  Errors:   ${errors}`)
console.log(`\nDone.`)
