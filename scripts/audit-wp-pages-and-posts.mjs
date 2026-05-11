/**
 * List the actual WP pages and posts (publish) to gauge import scope.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql'), 'utf-8')

function findInsertBlocks(table) {
  const blocks = []
  let i = 0
  while (true) {
    const s = sql.indexOf(`INSERT INTO \`${table}\` VALUES`, i)
    if (s < 0) break
    let j = s + `INSERT INTO \`${table}\` VALUES`.length
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
  return blocks
}

function parseRows(text) {
  const rows = []
  let i = 0
  const n = text.length
  while (i < n) {
    if (text[i] !== '(') { i++; continue }
    let depth = 0, inStr = false, j = i
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
  let i = 0, n = inner.length, buf = '', inStr = false
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

const blocks = findInsertBlocks('kd_posts')
const pages = []
const posts = []
for (const [s, e] of blocks) {
  const text = sql.slice(s, e)
  const data = text.slice(text.indexOf('VALUES') + 6)
  for (const r of parseRows(data)) {
    const f = splitFields(r)
    if (f.length < 21) continue
    const status = f[7], type = f[20]
    if (type === 'page' && status === 'publish') {
      pages.push({ id: f[0], date: f[2], title: f[5].replace(/\\'/g, "'"), slug: f[11], parent: f[17] })
    } else if (type === 'post' && status === 'publish') {
      posts.push({ id: f[0], date: f[2], title: f[5].replace(/\\'/g, "'"), slug: f[11] })
    }
  }
}

console.log(`Pages (publish): ${pages.length}`)
for (const p of pages.sort((a,b)=>Number(a.id)-Number(b.id))) {
  console.log(`  [${p.id.padStart(6)}] parent=${p.parent.padStart(5)} ${p.slug.padEnd(35)} | ${p.title}`)
}
console.log(`\nPosts (publish): ${posts.length}`)
console.log('  First 10:')
for (const p of posts.sort((a,b)=>Number(a.id)-Number(b.id)).slice(0, 10)) {
  console.log(`    [${p.id.padStart(6)}] ${p.date} ${p.slug.padEnd(50)} | ${p.title.slice(0, 60)}`)
}
console.log('  Last 5:')
for (const p of posts.sort((a,b)=>Number(b.id)-Number(a.id)).slice(0, 5)) {
  console.log(`    [${p.id.padStart(6)}] ${p.date} ${p.slug.padEnd(50)} | ${p.title.slice(0, 60)}`)
}

// Posts sorted by date
const sortedByDate = [...posts].sort((a, b) => b.date.localeCompare(a.date))
console.log('\n  Posts date range:')
console.log('    Newest:', sortedByDate[0]?.date, sortedByDate[0]?.title.slice(0,60))
console.log('    Oldest:', sortedByDate[sortedByDate.length-1]?.date, sortedByDate[sortedByDate.length-1]?.title.slice(0,60))

// Find blog category terms (taxonomy='category')
const ttBlocks = findInsertBlocks('kd_term_taxonomy')
const categoryTermIds = new Set()
for (const [s, e] of ttBlocks) {
  const text = sql.slice(s, e)
  const data = text.slice(text.indexOf('VALUES') + 6)
  for (const r of parseRows(data)) {
    const f = splitFields(r)
    // (tt_id, term_id, taxonomy, description, parent, count)
    if (f.length >= 3 && f[2] === 'category') categoryTermIds.add(f[1])
  }
}
const tBlocks = findInsertBlocks('kd_terms')
const categoryTerms = []
for (const [s, e] of tBlocks) {
  const text = sql.slice(s, e)
  const data = text.slice(text.indexOf('VALUES') + 6)
  for (const r of parseRows(data)) {
    const f = splitFields(r)
    if (f.length >= 3 && categoryTermIds.has(f[0])) {
      categoryTerms.push({ id: f[0], name: f[1].replace(/\\'/g, "'"), slug: f[2] })
    }
  }
}
console.log(`\nBlog categories (taxonomy='category'): ${categoryTerms.length}`)
for (const c of categoryTerms) {
  console.log(`  [${c.id.padStart(6)}] ${c.slug.padEnd(30)} | ${c.name}`)
}
