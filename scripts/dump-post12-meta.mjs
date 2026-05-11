import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../bigbike_vn__2026_04_17/sqldump.sql'), 'utf-8')

const post12 = {}
const lines = sql.split('\n')

for (const line of lines) {
  if (!line.startsWith('INSERT INTO `kd_postmeta`')) continue
  // Find all occurrences of post_id = 12
  let searchFrom = 0
  while (true) {
    const marker = ',12,'
    const idx = line.indexOf(marker, searchFrom)
    if (idx < 0) break
    searchFrom = idx + 1

    // Find the opening paren before this marker
    let parenStart = idx - 1
    while (parenStart >= 0 && line[parenStart] !== '(') parenStart--
    if (parenStart < 0) continue

    // Extract meta_id
    const idStr = line.slice(parenStart + 1, idx)
    if (!/^\d+$/.test(idStr)) continue

    // After ,12, we expect 'meta_key','meta_value'
    // Find the key
    const afterPostId = idx + marker.length
    if (line[afterPostId] !== "'") continue

    let keyEnd = afterPostId + 1
    while (keyEnd < line.length && line[keyEnd] !== "'") keyEnd++
    const key = line.slice(afterPostId + 1, keyEnd)

    // Find the value (may be NULL or 'string with escaped quotes')
    const afterKey = keyEnd + 1
    if (afterKey >= line.length) continue

    let val = null
    if (line[afterKey] === ',') {
      const valStart = afterKey + 1
      if (line[valStart] === 'N') {
        val = null
      } else if (line[valStart] === "'") {
        // Read until unescaped closing quote
        let i = valStart + 1
        let str = ''
        while (i < line.length) {
          if (line[i] === '\\') {
            str += line[i + 1]
            i += 2
          } else if (line[i] === "'") {
            break
          } else {
            str += line[i]
            i++
          }
        }
        val = str
      }
    }

    post12[key] = val
  }
}

console.log(`Found ${Object.keys(post12).length} meta keys for post 12`)
console.log('\nNon-underscore keys (ACF values):')
Object.entries(post12)
  .filter(([k]) => !k.startsWith('_'))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([k, v]) => {
    const display = v === null ? 'NULL' : v.length > 120 ? v.slice(0, 120) + '...' : v
    console.log(`  ${k.padEnd(45)} = ${display}`)
  })
