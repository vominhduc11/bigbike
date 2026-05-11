/**
 * Audit WordPress sqldump kd_posts table: count posts by post_type x post_status.
 * Used to gauge what content (blog posts, pages, videos, etc.) needs importing.
 *
 * Usage: node scripts/audit-wp-posts.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')

console.log('Reading SQL dump...')
const sql = readFileSync(DUMP_PATH, 'utf-8')
console.log(`  File size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`)

// Find all kd_posts INSERT blocks (data only — table can be split across many INSERTs)
const blocks = []
{
  let i = 0
  while (true) {
    const s = sql.indexOf('INSERT INTO `kd_posts` VALUES', i)
    if (s < 0) break
    // Statement ends with `;` followed by newline. Find end of statement.
    // We can't just look for `;` because content may contain semicolons inside strings.
    // Use the same depth/quote tracking.
    let j = s + 'INSERT INTO `kd_posts` VALUES'.length
    let inStr = false
    while (j < sql.length) {
      const c = sql[j]
      if (inStr) {
        if (c === '\\') { j += 2; continue }
        if (c === "'") inStr = false
        j++
      } else {
        if (c === "'") { inStr = true; j++; continue }
        if (c === ';') break
        j++
      }
    }
    blocks.push([s, j])
    i = j + 1
  }
}
console.log(`  ${blocks.length} kd_posts INSERT blocks`)

function parseRows(text) {
  const rows = []
  let i = 0
  const n = text.length
  while (i < n) {
    if (text[i] !== '(') { i++; continue }
    let depth = 0
    let inStr = false
    let j = i
    while (j < n) {
      const c = text[j]
      if (inStr) {
        if (c === '\\') { j += 2; continue }
        if (c === "'") inStr = false
        j++
      } else {
        if (c === "'") { inStr = true; j++; continue }
        if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) { rows.push(text.slice(i, j + 1)); i = j + 1; break }
        }
        j++
      }
    }
    if (j >= n) break
  }
  return rows
}

function splitFields(row) {
  const inner = row.slice(1, -1)
  const out = []
  let i = 0
  const n = inner.length
  let buf = ''
  let inStr = false
  while (i < n) {
    const c = inner[i]
    if (inStr) {
      if (c === '\\') { buf += c + (inner[i + 1] ?? ''); i += 2; continue }
      if (c === "'") { inStr = false; i++; continue }
      buf += c; i++
    } else {
      if (c === "'") { inStr = true; i++; continue }
      if (c === ',') { out.push(buf); buf = ''; i++; continue }
      buf += c; i++
    }
  }
  out.push(buf)
  return out
}

const counts = {}
const sample = {}
let totalRows = 0
for (const [s, e] of blocks) {
  const text = sql.slice(s, e)
  const valuesIdx = text.indexOf('VALUES')
  const data = text.slice(valuesIdx + 6)
  const rows = parseRows(data)
  for (const r of rows) {
    totalRows++
    const f = splitFields(r)
    if (f.length < 21) continue
    const status = f[7]
    const type = f[20]
    const key = `${type}:${status}`
    counts[key] = (counts[key] || 0) + 1
    if (!sample[key]) {
      sample[key] = {
        id: f[0],
        title: f[5].slice(0, 80).replace(/\\'/g, "'"),
        slug: f[11].slice(0, 60),
      }
    }
  }
}

console.log(`\nTotal post rows: ${totalRows}`)
console.log('\npost_type:post_status counts:')
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
for (const [k, v] of sorted) {
  console.log(`  ${String(v).padStart(6)} ${k.padEnd(30)} | sample: ${JSON.stringify(sample[k])}`)
}
