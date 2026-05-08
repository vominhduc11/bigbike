#!/usr/bin/env node
/**
 * Check that vi.json and en.json have identical key structures.
 * Reports keys present in one file but missing in the other.
 * Exit code 1 when any mismatch is found.
 *
 * Usage:  node scripts/check-i18n.js
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dir, '..', 'src', 'locales')

const vi = JSON.parse(readFileSync(join(localesDir, 'vi.json'), 'utf8'))
const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'))

function collectKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

const viKeys = new Set(collectKeys(vi))
const enKeys = new Set(collectKeys(en))

const missingInEn = [...viKeys].filter(k => !enKeys.has(k))
const missingInVi = [...enKeys].filter(k => !viKeys.has(k))

let hasErrors = false

if (missingInEn.length > 0) {
  console.error(`\n❌  ${missingInEn.length} key(s) present in vi.json but MISSING in en.json:`)
  missingInEn.forEach(k => console.error(`     - ${k}`))
  hasErrors = true
}

if (missingInVi.length > 0) {
  console.error(`\n❌  ${missingInVi.length} key(s) present in en.json but MISSING in vi.json:`)
  missingInVi.forEach(k => console.error(`     - ${k}`))
  hasErrors = true
}

if (hasErrors) {
  console.error('\nFix the mismatches above to keep both translation files in sync.\n')
  process.exit(1)
} else {
  console.log(`✅  vi.json and en.json are in sync (${viKeys.size} keys each).`)
}
