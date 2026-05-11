/**
 * Parse WordPress SQL dump to extract homepage slider/banner data from post 12.
 * ACF stores slider repeater fields in kd_postmeta for post_id = 12.
 *
 * Usage: node scripts/parse-wp-sliders.mjs
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

// ── 1. Extract all postmeta for post_id = 12 ─────────────────────────────────
// kd_postmeta row format: (meta_id,post_id,'meta_key','meta_value')
console.log('\n1. Extracting postmeta for post 12...')
const post12Meta = {}

// Find kd_postmeta INSERT blocks
const postmetaBlocks = sql.match(/INSERT INTO `kd_postmeta` VALUES ([^;]+);/g) || []
console.log(`   Found ${postmetaBlocks.length} kd_postmeta INSERT blocks`)

for (const block of postmetaBlocks) {
  // Match rows: (meta_id,12,'meta_key','meta_value') — value can contain escaped quotes
  const rowRe = /\((\d+),12,'((?:[^'\\]|\\.)*)',(NULL|'(?:[^'\\|\n]|\\.)*')\)/g
  let m
  while ((m = rowRe.exec(block)) !== null) {
    const key = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\')
    const rawVal = m[3]
    const val = rawVal === 'NULL' ? null : rawVal.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\')
    post12Meta[key] = val
  }
}

console.log(`   Extracted ${Object.keys(post12Meta).length} meta keys for post 12`)

// ── 2. Show all slider-related keys ──────────────────────────────────────────
console.log('\n2. Slider / banner related keys:')
const sliderKeys = Object.keys(post12Meta).filter(k =>
  k.includes('slider') || k.includes('banner') || k.includes('slide') ||
  k.includes('_image') || k.includes('promo') || k.includes('hero')
)
for (const k of sliderKeys.sort()) {
  console.log(`   ${k.padEnd(50)} = ${String(post12Meta[k]).slice(0, 80)}`)
}

// ── 3. Find ACF slider repeater structure ────────────────────────────────────
// ACF repeater: key = 'slides' (count), then 'slides_0_image', 'slides_0_link', etc.
console.log('\n3. ACF repeater analysis:')
const allKeys = Object.keys(post12Meta).sort()
const repeaterCandidates = allKeys.filter(k => /^\w+$/.test(k) && !isNaN(Number(post12Meta[k])) && Number(post12Meta[k]) > 0 && Number(post12Meta[k]) < 30)
console.log('   Possible repeater count keys:', repeaterCandidates.map(k => `${k}=${post12Meta[k]}`).join(', '))

// Find any key that looks like a repeater index pattern: prefix_N_field
const repeaterPrefixes = new Set()
for (const k of allKeys) {
  const m = k.match(/^(.+?)_(\d+)_(.+)$/)
  if (m) repeaterPrefixes.add(m[1])
}
console.log('   Repeater prefixes found:', [...repeaterPrefixes].join(', '))

// ── 4. Parse slider repeater rows ────────────────────────────────────────────
// Try known ACF slider field names
const SLIDER_PREFIXES = ['slides', 'slider', 'home_slider', 'banner', 'hero_slider']

for (const prefix of SLIDER_PREFIXES) {
  const countKey = prefix
  const count = post12Meta[countKey] ? parseInt(post12Meta[countKey]) : null
  if (count !== null && count > 0) {
    console.log(`\n4. Found repeater "${prefix}" with ${count} items:`)
    for (let i = 0; i < count; i++) {
      const item = {}
      const itemKeys = allKeys.filter(k => k.startsWith(`${prefix}_${i}_`) || k.startsWith(`_${prefix}_${i}_`))
      for (const k of itemKeys) {
        const field = k.replace(`${prefix}_${i}_`, '').replace(`_${prefix}_${i}_`, '')
        item[field] = post12Meta[k]
      }
      console.log(`   [${i}]:`, JSON.stringify(item, null, 4))
    }
  }
}

// ── 5. Show ALL post 12 keys for full audit ───────────────────────────────────
console.log('\n5. ALL post 12 meta keys:')
for (const k of allKeys) {
  const v = post12Meta[k]
  if (v && v.length > 100) {
    console.log(`   ${k.padEnd(50)} = [${v.length} chars]`)
  } else {
    console.log(`   ${k.padEnd(50)} = ${v}`)
  }
}

// ── 6. Look for attachment IDs referenced in slider data ─────────────────────
// Try to find _wp_attached_file paths for any attachment IDs found in repeater
console.log('\n6. Resolving attachment file paths...')
const attachmentIds = new Set()
for (const k of allKeys) {
  const v = post12Meta[k]
  if (v && /^\d+$/.test(v) && parseInt(v) > 1000) {
    attachmentIds.add(v)
  }
}

if (attachmentIds.size > 0) {
  const filePaths = {}
  const fileRe = /\((\d+),(\d+),'_wp_attached_file','((?:[^'\\]|\\.)*)'\)/g
  let m
  while ((m = fileRe.exec(sql)) !== null) {
    if (attachmentIds.has(m[2])) {
      filePaths[m[2]] = m[3]
    }
  }
  console.log(`   Resolved ${Object.keys(filePaths).length} of ${attachmentIds.size} attachment IDs`)
  for (const [id, path] of Object.entries(filePaths)) {
    console.log(`   ${id} → ${WP_UPLOADS_BASE}/${path}`)
  }
}

// Save output
const outPath = join(__dirname, 'wp-post12-meta.json')
writeFileSync(outPath, JSON.stringify(post12Meta, null, 2), 'utf-8')
console.log(`\nSaved all post 12 meta → scripts/wp-post12-meta.json`)
