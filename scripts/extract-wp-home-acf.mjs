// Extract ACF fields from the WP homepage (wp_posts.ID = 12) so we can seed:
//   home_content_bottom_html  ← content_bottom
//   about_title               ← about_us_0_title
//   about_subtitle            ← about_us_0_sub_title
//   about_content_html        ← about_us_0_content
//
// Also pulls the Yoast SEO title/desc (already used: seo_home_title, seo_home_description)
// for cross-checking with what's already in DB.
//
// The previous dump-post12-meta.mjs missed `content_bottom` because it scans
// line by line — mysqldump emits one mega-INSERT-per-table whose `(…)` tuples
// are separated by `,` only, not by newlines. We scan as a single buffer here.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const sql = readFileSync(sqlPath, 'utf8')

const POST_ID = '12'

// Walk all `(meta_id, post_id, 'key', 'value')` tuples appearing in any
// `INSERT INTO kd_postmeta VALUES (...)` statement and pick those with
// post_id === POST_ID.

function unescape(str) {
  // mysqldump escapes: \\ \' \" \n \r \t \0 \Z
  let out = ''
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') {
      const n = str[i + 1]
      if (n === 'n') out += '\n'
      else if (n === 'r') out += '\r'
      else if (n === 't') out += '\t'
      else if (n === '0') out += '\0'
      else if (n === 'Z') out += ''
      else if (n === "'" || n === '"' || n === '\\') out += n
      else out += n // fallback
      i++
    } else {
      out += str[i]
    }
  }
  return out
}

// Streaming-style scan: find each INSERT INTO `kd_postmeta` block, then
// step through its tuples.
function* iterPostmetaTuples(buf) {
  let cursor = 0
  while (true) {
    const start = buf.indexOf('INSERT INTO `kd_postmeta`', cursor)
    if (start < 0) return
    const valuesIdx = buf.indexOf('VALUES', start)
    if (valuesIdx < 0) return
    let i = valuesIdx + 'VALUES'.length
    // The statement ends at `;` outside any string. Find that bound.
    let end = i
    let inStr = false
    while (end < buf.length) {
      const c = buf[end]
      if (c === '\\') { end += 2; continue }
      if (c === "'") inStr = !inStr
      else if (c === ';' && !inStr) break
      end++
    }
    // Now walk tuples within [i, end)
    while (i < end) {
      while (i < end && buf[i] !== '(') i++
      if (i >= end) break
      i++ // past '('
      // Read meta_id (digits)
      let j = i
      while (j < end && /[0-9]/.test(buf[j])) j++
      const metaId = buf.slice(i, j)
      if (buf[j] !== ',') { i = j; continue }
      i = j + 1
      // Read post_id (digits)
      j = i
      while (j < end && /[0-9]/.test(buf[j])) j++
      const postId = buf.slice(i, j)
      if (buf[j] !== ',') { i = j; continue }
      i = j + 1
      // Read meta_key ('...')
      if (buf[i] !== "'") { continue }
      j = i + 1
      while (j < end) {
        if (buf[j] === '\\') { j += 2; continue }
        if (buf[j] === "'") break
        j++
      }
      const metaKey = unescape(buf.slice(i + 1, j))
      i = j + 1
      if (buf[i] !== ',') { continue }
      i++
      // Read meta_value: NULL or '...'
      let metaVal = null
      if (buf[i] === 'N' && buf.startsWith('NULL', i)) {
        metaVal = null
        i += 4
      } else if (buf[i] === "'") {
        j = i + 1
        while (j < end) {
          if (buf[j] === '\\') { j += 2; continue }
          if (buf[j] === "'") break
          j++
        }
        metaVal = unescape(buf.slice(i + 1, j))
        i = j + 1
      } else {
        // unknown — skip until ')'
        while (i < end && buf[i] !== ')') i++
      }
      // Skip closing ')'
      while (i < end && buf[i] !== ')') i++
      if (buf[i] === ')') i++
      yield { metaId, postId, metaKey, metaVal }
    }
    cursor = end + 1
  }
}

const meta = {}
let count = 0
for (const row of iterPostmetaTuples(sql)) {
  if (row.postId !== POST_ID) continue
  meta[row.metaKey] = row.metaVal
  count++
}

console.log(`Scanned all kd_postmeta tuples.`)
console.log(`Post ${POST_ID} meta keys: ${count}`)
console.log()

const interesting = [
  'content_bottom',
  'about_us_0_title',
  'about_us_0_sub_title',
  'about_us_0_content',
  '_yoast_wpseo_title',
  '_yoast_wpseo_metadesc',
  'rank_math_title',
  'rank_math_description',
]

for (const key of interesting) {
  const v = meta[key]
  if (v === undefined) {
    console.log(`  ${key.padEnd(28)} (missing)`)
  } else if (v === null) {
    console.log(`  ${key.padEnd(28)} = NULL`)
  } else {
    const head = v.length > 100 ? v.slice(0, 100) + '...' : v
    console.log(`  ${key.padEnd(28)} = (${v.length}c) ${head.replace(/\n/g, ' ')}`)
  }
}

// Also surface every about_us_* repeater entry, since there might be multiple.
console.log('\nAll about_us_* repeater fields on post 12:')
const aboutKeys = Object.keys(meta).filter((k) => k.startsWith('about_us_')).sort()
for (const k of aboutKeys) {
  const v = meta[k]
  const head = v == null ? 'NULL' : (v.length > 100 ? v.slice(0, 100) + '...' : v)
  console.log(`  ${k.padEnd(34)} = ${head.replace(/\n/g, ' ')}`)
}

// Persist a JSON snapshot for the migration builder to consume.
const out = join(__dirname, 'wp-post12-acf.json')
writeFileSync(out, JSON.stringify(meta, null, 2), 'utf8')
console.log(`\nSaved full meta to ${out}`)
