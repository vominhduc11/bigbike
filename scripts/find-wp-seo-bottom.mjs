// Locate the WP option/post that contains the homepage SEO bottom HTML.
// Strategy: search for the distinctive Vietnamese phrases that historically
// appear in the BigBike homepage bottom block, then dump 4KB of context
// around each hit so we can identify the row (post id, option name, etc.).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql')
const sql = readFileSync(sqlPath, 'utf8')

const phrases = [
  'Shop bán đồ',
  'Bigbike là shop',
  'Shop đồ bảo hộ',
  'Bigbike là shop bảo hộ',
]

for (const p of phrases) {
  console.log('\n=========================')
  console.log('SEARCH:', p)
  console.log('=========================')
  let from = 0
  let count = 0
  while (count < 5) {
    const idx = sql.indexOf(p, from)
    if (idx < 0) break
    count++
    // Walk back to find the start of this VALUES tuple to identify the table/row
    let back = idx
    let table = '?'
    let lineStart = idx
    while (lineStart > 0 && sql[lineStart - 1] !== '\n') lineStart--
    const lineEnd = sql.indexOf('\n', idx)
    const lineHead = sql.slice(lineStart, lineStart + 80)
    const tableMatch = lineHead.match(/INSERT INTO `([^`]+)`/)
    table = tableMatch ? tableMatch[1] : '(no INSERT prefix on this line)'
    // Walk back inside the line to find the opening '(' of this tuple
    let parenStart = idx
    let depth = 0
    let inStr = false
    while (parenStart > lineStart) {
      parenStart--
      const c = sql[parenStart]
      // Handle escaped quotes naively (good enough)
      if (c === "'" && sql[parenStart - 1] !== '\\') inStr = !inStr
      if (!inStr) {
        if (c === ')') depth++
        else if (c === '(') {
          if (depth === 0) break
          depth--
        }
      }
    }
    // Extract first ~30 chars of this tuple (likely id + key/title)
    const tupleHead = sql.slice(parenStart, parenStart + 200)
    console.log(`\nMatch #${count}  table=${table}  offset=${idx}`)
    console.log(`  Tuple head: ${tupleHead.replace(/\n/g, ' ').slice(0, 200)}`)
    // Print 800 chars around the hit
    const ctx = sql.slice(Math.max(0, idx - 100), idx + 700)
    console.log(`  ── context ─────────────`)
    console.log(ctx.replace(/\\n/g, '\n').replace(/\\'/g, "'").slice(0, 800))
    from = idx + p.length
  }
  if (count === 0) console.log('  no match')
}
