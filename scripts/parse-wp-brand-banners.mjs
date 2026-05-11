/**
 * Parse WP dump for brand banner images (pwb_brand_banner).
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const WP_BASE = 'https://bigbike.vn/wp-content/uploads'

console.log('Reading dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')
const lines = sql.split('\n')

// 1. Find all pwb_brand_banner entries
console.log('\n1. Brand banner termmeta:')
const brandBanners = {} // termId -> attachmentId
for (const line of lines) {
  if (!line.includes('pwb_brand_banner')) continue
  const matches = line.matchAll(/\((\d+),(\d+),'pwb_brand_banner','?(\d+)'?\)/g)
  for (const m of matches) {
    brandBanners[m[2]] = m[3]
    console.log(`   term_id=${m[2]} → attach_id=${m[3]}`)
  }
}

// 2. Find pwb_brand_image for all brands (for reference)
const brandLogos = {}
for (const line of lines) {
  if (!line.includes('pwb_brand_image')) continue
  const matches = line.matchAll(/\((\d+),(\d+),'pwb_brand_image','?(\d+)'?\)/g)
  for (const m of matches) {
    brandLogos[m[2]] = m[3]
  }
}
console.log(`   (${Object.keys(brandLogos).length} total brands have logo, ${Object.keys(brandBanners).length} have banner)`)

// 3. Get term names from kd_terms
const allTermIds = new Set([...Object.keys(brandBanners), ...Object.keys(brandLogos)])
const terms = {}
for (const line of lines) {
  if (!line.startsWith('INSERT INTO `kd_terms`')) continue
  // Parse rows: (id,'name','slug',group)
  let i = 0
  while (i < line.length) {
    const start = line.indexOf('(', i)
    if (start < 0) break
    const end = line.indexOf(')', start)
    if (end < 0) break
    const row = line.slice(start + 1, end)
    // Split by comma, accounting for quoted strings
    const parts = []
    let inQuote = false
    let curr = ''
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "'" && row[c-1] !== '\\') {
        inQuote = !inQuote
        curr += row[c]
      } else if (row[c] === ',' && !inQuote) {
        parts.push(curr)
        curr = ''
      } else {
        curr += row[c]
      }
    }
    parts.push(curr)
    if (parts.length >= 3) {
      const id = parts[0].trim()
      const name = parts[1].trim().replace(/^'/, '').replace(/'$/, '').replace(/\\'/g, "'")
      const slug = parts[2].trim().replace(/^'/, '').replace(/'$/, '')
      if (allTermIds.has(id)) {
        terms[id] = { name, slug }
      }
    }
    i = end + 1
  }
  break
}

// 4. Resolve attachment file paths
const allAttachIds = new Set([
  ...Object.values(brandBanners),
  ...Object.values(brandLogos)
])
const filePaths = {}
for (const line of lines) {
  if (!line.includes('_wp_attached_file')) continue
  const matches = line.matchAll(/\((\d+),(\d+),'_wp_attached_file','([^']+)'\)/g)
  for (const m of matches) {
    if (allAttachIds.has(m[2])) {
      filePaths[m[2]] = `${WP_BASE}/${m[3]}`
    }
  }
}

// 5. Build result
console.log('\n2. Brand banners with resolved URLs:')
const result = []
for (const [termId, attachId] of Object.entries(brandBanners)) {
  const term = terms[termId] || { name: `(unknown term ${termId})`, slug: `term-${termId}` }
  const bannerUrl = filePaths[attachId] || null
  const logoAttachId = brandLogos[termId]
  const logoUrl = logoAttachId ? (filePaths[logoAttachId] || null) : null
  const item = {
    termId,
    backendId: `wp-brand-${termId}`,
    name: term.name,
    slug: term.slug,
    bannerAttachId: attachId,
    bannerUrl,
    logoUrl,
  }
  result.push(item)
  console.log(JSON.stringify(item, null, 2))
}

writeFileSync(join(__dirname, 'wp-brand-banners.json'), JSON.stringify(result, null, 2))
console.log('\nSaved → scripts/wp-brand-banners.json')
