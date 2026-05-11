// One-shot helper to dump the wp_posts row for ID=12 (the homepage page).
// Reads sqldump.sql as a stream-ish single string (150MB; node handles it).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const sql = readFileSync(sqlPath, 'utf8')

// Naive but works: scan INSERT INTO `kd_posts` lines, walk each row inside the
// VALUES list, parse fields. wp_posts column order:
// (ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
//  post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged,
//  post_modified, post_modified_gmt, post_content_filtered, post_parent, guid,
//  menu_order, post_type, post_mime_type, comment_count)

function parseRow(text, startIdx) {
  // Walks values inside one (...) tuple starting AT the '(' at startIdx,
  // returning array of values (string|null) and the index AFTER the closing ')'.
  const values = []
  let i = startIdx + 1
  while (i < text.length) {
    if (text[i] === ')') return { values, end: i + 1 }
    if (text[i] === ',') { i++; continue }
    if (text[i] === ' ') { i++; continue }
    if (text[i] === 'N' && text.startsWith('NULL', i)) {
      values.push(null); i += 4; continue
    }
    if (/[0-9-]/.test(text[i])) {
      let j = i
      while (j < text.length && /[0-9.-]/.test(text[j])) j++
      values.push(text.slice(i, j))
      i = j; continue
    }
    if (text[i] === "'") {
      let j = i + 1
      let buf = ''
      while (j < text.length) {
        const c = text[j]
        if (c === '\\') { buf += text[j + 1]; j += 2; continue }
        if (c === "'") break
        buf += c; j++
      }
      values.push(buf)
      i = j + 1; continue
    }
    // Unknown — bail.
    return null
  }
  return null
}

const lines = sql.split('\n')
const cols = [
  'ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content', 'post_title',
  'post_excerpt', 'post_status', 'comment_status', 'ping_status', 'post_password',
  'post_name', 'to_ping', 'pinged', 'post_modified', 'post_modified_gmt',
  'post_content_filtered', 'post_parent', 'guid', 'menu_order', 'post_type',
  'post_mime_type', 'comment_count',
]

let post12 = null
for (const line of lines) {
  if (!line.startsWith('INSERT INTO `kd_posts`')) continue
  // Find each row tuple
  let i = line.indexOf('VALUES')
  if (i < 0) continue
  // Skip past 'VALUES '
  i += 'VALUES'.length
  while (i < line.length) {
    while (i < line.length && line[i] !== '(') i++
    if (i >= line.length) break
    const parsed = parseRow(line, i)
    if (!parsed) { i++; continue }
    if (parsed.values[0] === '12') {
      post12 = Object.fromEntries(cols.map((c, idx) => [c, parsed.values[idx]]))
      break
    }
    i = parsed.end
  }
  if (post12) break
}

if (!post12) {
  console.log('Post 12 not found.')
  process.exit(1)
}

console.log('--- POST 12 META ---')
for (const k of cols) {
  if (k === 'post_content') continue
  const v = post12[k]
  console.log(`  ${k.padEnd(22)} = ${v === null ? 'NULL' : (v.length > 80 ? v.slice(0, 80) + '...' : v)}`)
}

const out = join(__dirname, 'wp-post12-content.html')
writeFileSync(out, post12.post_content || '', 'utf8')
console.log(`\nWrote post_content to ${out} (${(post12.post_content || '').length} chars)`)
