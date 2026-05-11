/**
 * Parse WordPress SQL dump to extract brand logos.
 * Uses targeted regex instead of full SQL parsing to avoid HTML-in-description issues.
 *
 * Usage: node scripts/parse-wp-brands.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const WP_UPLOADS_BASE = 'https://bigbike.vn/wp-content/uploads'

console.log('Reading SQL dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')
console.log(`  File size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`)

// ── 1. Extract all pwb-brand term_ids from kd_term_taxonomy ──────────────────
// Row format: (term_taxonomy_id,term_id,'pwb-brand','desc',parent,count)
// We search for the pattern: ,DIGITS,'pwb-brand', to get term_id
console.log('\n1. Finding pwb-brand term IDs...')
const brandTermIds = new Set()
// Match: (number,number,'pwb-brand', — inside kd_term_taxonomy
const ttRe = /\((\d+),(\d+),'pwb-brand',/g
let m
while ((m = ttRe.exec(sql)) !== null) {
  brandTermIds.add(m[2]) // m[2] = term_id
}
console.log(`   Found ${brandTermIds.size} pwb-brand terms`)

// ── 2. Extract term names and slugs from kd_terms ────────────────────────────
// Row format: (term_id,'name','slug',term_group)
console.log('\n2. Extracting term names/slugs...')
const terms = {}
// Find kd_terms INSERT block
const termsBlock = sql.match(/INSERT INTO `kd_terms` VALUES ([\s\S]*?);/)
if (termsBlock) {
  // Match each row: (number,'name','slug',number)
  const rowRe = /\((\d+),'((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)',\d+\)/g
  let r
  while ((r = rowRe.exec(termsBlock[1])) !== null) {
    const id = r[1]
    if (brandTermIds.has(id)) {
      terms[id] = {
        name: r[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
        slug: r[3],
      }
    }
  }
}
console.log(`   Matched names for ${Object.keys(terms).length} brand terms`)

// ── 3. Extract pwb_brand_image meta values from kd_termmeta ─────────────────
// Row format: (meta_id,term_id,'pwb_brand_image',attachment_id)
console.log('\n3. Extracting brand image attachment IDs...')
const brandAttachmentId = {} // termId -> attachmentId
const metaRe = /\((\d+),(\d+),'pwb_brand_image','?(\d+)'?\)/g
while ((m = metaRe.exec(sql)) !== null) {
  const termId = m[2]
  const attachmentId = m[3]
  if (brandTermIds.has(termId)) {
    brandAttachmentId[termId] = attachmentId
  }
}
console.log(`   Found attachment IDs for ${Object.keys(brandAttachmentId).length} brands`)

// ── 4. Extract file paths from kd_postmeta ────────────────────────────────────
// Row format: (meta_id,post_id,'_wp_attached_file','2024/03/filename.jpg')
console.log('\n4. Looking up attachment file paths...')
const neededIds = new Set(Object.values(brandAttachmentId))
const filePaths = {} // attachmentId -> relative path
const fileRe = /\((\d+),(\d+),'_wp_attached_file','((?:[^'\\]|\\.)*)'\)/g
while ((m = fileRe.exec(sql)) !== null) {
  const postId = m[2]
  if (neededIds.has(postId)) {
    filePaths[postId] = m[3]
  }
}
console.log(`   Resolved paths for ${Object.keys(filePaths).length} attachments`)

// ── 5. Build final result ─────────────────────────────────────────────────────
console.log('\n5. Building result...')
const result = []
for (const termId of brandTermIds) {
  const term = terms[termId]
  const attachmentId = brandAttachmentId[termId]
  const filePath = attachmentId ? filePaths[attachmentId] : null
  const logoUrl = filePath ? `${WP_UPLOADS_BASE}/${filePath}` : null

  result.push({
    slug: term?.slug ?? `term-${termId}`,
    name: term?.name ?? `Unknown (${termId})`,
    logoUrl,
    _termId: termId,
    _attachmentId: attachmentId ?? null,
  })
}
result.sort((a, b) => a.slug.localeCompare(b.slug))

const outPath = join(__dirname, 'wp-brands-logos.json')
writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')

// ── Summary ───────────────────────────────────────────────────────────────────
const withLogo = result.filter(b => b.logoUrl)
const withoutLogo = result.filter(b => !b.logoUrl)

console.log('\n═══════════════════════════════════════')
console.log(`Total brands:    ${result.length}`)
console.log(`With logo URL:   ${withLogo.length}`)
console.log(`Without logo:    ${withoutLogo.length}`)
console.log(`\nSaved → scripts/wp-brands-logos.json`)

console.log('\nBrands WITH logo:')
for (const b of withLogo) {
  console.log(`  [${b._termId.padStart(4)}] ${b.slug.padEnd(25)} ${b.logoUrl}`)
}
if (withoutLogo.length) {
  console.log('\nBrands WITHOUT logo:')
  for (const b of withoutLogo) {
    console.log(`  [${b._termId.padStart(4)}] ${b.slug}  (name: ${b.name})`)
  }
}
