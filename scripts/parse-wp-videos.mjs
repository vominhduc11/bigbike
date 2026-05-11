/**
 * Parse WordPress SQL dump to extract homepage video data.
 * Looks in:
 *  1. ACF options (kd_options table) for any 'video' / 'youtube' keys
 *  2. Homepage post (post_id = 12 and any 'page' type with front-page template)
 *  3. Any postmeta with video-related keys
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')

console.log('Reading SQL dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')
console.log(`  File size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`)

// ── 1. Find kd_options rows with video/youtube keys ──────────────────────────
console.log('\n1. Searching kd_options for video/youtube entries...')
const optBlocks = sql.match(/INSERT INTO `kd_options` VALUES ([^;]+);/g) || []
console.log(`   Found ${optBlocks.length} kd_options INSERT blocks`)

const optVideoRows = []
for (const block of optBlocks) {
  const rowRe = /\((\d+),'((?:[^'\\]|\\.)*)',(NULL|'(?:[^'\\]|\\.)*'),\d+\)/g
  let m
  while ((m = rowRe.exec(block)) !== null) {
    const key = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\')
    if (/video|youtube|embed/i.test(key) && !key.includes('transient') && !key.includes('schedule')) {
      const val = m[3] === 'NULL' ? null : m[3].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\')
      optVideoRows.push({ key, val: val?.slice(0, 200) })
    }
  }
}
console.log(`   Found ${optVideoRows.length} video-related option rows:`)
for (const r of optVideoRows) {
  console.log(`   ${r.key.padEnd(50)} = ${r.val?.slice(0, 100)}`)
}

// ── 2. Find ACF-options-style postmeta (post_id = 0 or special options post) ─
console.log('\n2. Checking postmeta for option-post video keys (post_id in 1..50)...')
const postmetaBlocks = sql.match(/INSERT INTO `kd_postmeta` VALUES ([^;]+);/g) || []
const optionPostMeta = {}

for (const block of postmetaBlocks) {
  const rowRe = /\((\d+),(\d+),'((?:[^'\\]|\\.)*)',(NULL|'(?:[^'\\]|\\.)*')\)/g
  let m
  while ((m = rowRe.exec(block)) !== null) {
    const postId = parseInt(m[2])
    if (postId > 50) continue  // only check early posts (homepage, options)
    const key = m[3].replace(/\\'/g, "'").replace(/\\\\/g, '\\')
    if (/video|youtube|embed/i.test(key)) {
      if (!optionPostMeta[postId]) optionPostMeta[postId] = {}
      const val = m[4] === 'NULL' ? null : m[4].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\')
      optionPostMeta[postId][key] = val
    }
  }
}

for (const [postId, meta] of Object.entries(optionPostMeta)) {
  console.log(`\n   Post ${postId} video meta:`)
  for (const [k, v] of Object.entries(meta)) {
    console.log(`     ${k.padEnd(50)} = ${String(v).slice(0, 100)}`)
  }
}

// ── 3. Find posts containing youtube embed in post_content ───────────────────
console.log('\n3. Finding posts with YouTube embed in post_content...')
const postBlocks = sql.match(/INSERT INTO `kd_posts` VALUES ([^;]+);/g) || []
console.log(`   Found ${postBlocks.length} kd_posts INSERT blocks`)

// Look for page-type posts with youtube in content
const youtubePostRe = /\((\d+),\d+,'[^']*','[^']*','([^']*youtube[^']*|[^']*video[^']*)','[^']*','(publish|draft)','[^']*','[^']*','[^']*','([^']*)','[^']*','[^']*','[^']*','[^']*','[^']*','[^']*',\d+,'[^']*',0,'(page|post)'/i
// This is complex; let's do a simpler search

const youtubePosts = []
for (const block of postBlocks) {
  // Find each row: (id, author, ..., post_content, ..., post_type)
  // post rows: (id,author_id,post_date,post_date_gmt,post_content,post_title,...,post_type,...)
  const simpleRe = /\((\d+),\d+,'[^']*','[^']*','((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = simpleRe.exec(block)) !== null) {
    const postId = m[1]
    const content = m[2]
    if (/youtube\.com\/embed|youtu\.be|youtube\.com\/watch/i.test(content)) {
      // Extract YouTube IDs from content
      const ytIds = []
      const idRe = /youtube\.com\/embed\/([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})|youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/g
      let ytm
      while ((ytm = idRe.exec(content)) !== null) {
        ytIds.push(ytm[1] || ytm[2] || ytm[3])
      }
      if (ytIds.length > 0) {
        youtubePosts.push({ postId, ytIds: [...new Set(ytIds)], contentSnippet: content.slice(0, 200) })
      }
    }
  }
}

console.log(`   Found ${youtubePosts.length} posts with YouTube embeds`)
for (const p of youtubePosts.slice(0, 20)) {
  console.log(`   Post ${p.postId}: [${p.ytIds.join(', ')}] — ${p.contentSnippet.slice(0, 80)}`)
}

// ── 4. Specifically check homepage post (find which page is front page) ──────
console.log('\n4. Finding front page / homepage in WP...')
for (const block of optBlocks) {
  const rowRe = /\((\d+),'(page_on_front|page_for_posts|show_on_front)',(NULL|'[^']*'),\d+\)/g
  let m
  while ((m = rowRe.exec(block)) !== null) {
    const key = m[2]
    const val = m[3] === 'NULL' ? null : m[3].slice(1, -1)
    console.log(`   ${key} = ${val}`)
  }
}

// ── 5. Extract youtube.com/embed URLs from posts table ───────────────────────
console.log('\n5. Counting all unique YouTube video IDs in WP content...')
const allYtIds = new Set()
const ytRe = /youtube\.com\/embed\/([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})|youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/g
let ytm
while ((ytm = ytRe.exec(sql)) !== null) {
  allYtIds.add(ytm[1] || ytm[2] || ytm[3])
}
console.log(`   Total unique YouTube IDs: ${allYtIds.size}`)
console.log('   IDs:', [...allYtIds].join(', '))

// ── 6. Look for home-page specific ACF video repeater ────────────────────────
console.log('\n6. Looking for home video repeater in all postmeta...')
// Find any postmeta key like 'home_videos', 'videos_section', etc.
const homeVideoMeta = {}
for (const block of postmetaBlocks) {
  const rowRe2 = /\((\d+),(\d+),'((?:[^'\\]|\\.)*(?:home_video|video_section|section_video|homepage_video)(?:[^'\\]|\\.)*)',(NULL|'(?:[^'\\]|\\.)*')\)/gi
  let m
  while ((m = rowRe2.exec(block)) !== null) {
    const postId = m[2]
    const key = m[3]
    const val = m[4] === 'NULL' ? null : m[4].slice(1, -1)
    if (!homeVideoMeta[postId]) homeVideoMeta[postId] = {}
    homeVideoMeta[postId][key] = val?.slice(0, 200)
  }
}
for (const [postId, meta] of Object.entries(homeVideoMeta)) {
  console.log(`   Post ${postId}:`, meta)
}
if (Object.keys(homeVideoMeta).length === 0) {
  console.log('   (none found)')
}

// ── Save summary ──────────────────────────────────────────────────────────────
const output = {
  optionVideoKeys: optVideoRows,
  optionPostVideoMeta: optionPostMeta,
  postsWithYoutube: youtubePosts.slice(0, 30),
  allUniqueYoutubeIds: [...allYtIds],
  homeVideoMeta,
}
const outPath = join(__dirname, 'wp-videos-parsed.json')
writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
console.log(`\nSaved → scripts/wp-videos-parsed.json`)
