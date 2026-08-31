#!/usr/bin/env node
/**
 * Check locale parity and every production translation call.
 *
 * This is intentionally stricter than comparing vi.json and en.json: a pair of
 * equally incomplete files is still a broken UI. The source scan covers static
 * keys, dynamic key patterns, resolvable key maps, and unsafe runtime fallbacks.
 *
 * Usage: node scripts/check-i18n.js
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative } from 'node:path'
import { analyzeI18n } from '../src/lib/i18nGuard.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const adminDir = join(scriptDir, '..')
const localesDir = join(adminDir, 'src', 'locales')
const sourceDir = join(adminDir, 'src')

function readJson(name) {
  return JSON.parse(readFileSync(join(localesDir, name), 'utf8'))
}

function collectSources(dir) {
  const sources = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (name !== 'locales') sources.push(...collectSources(path))
      continue
    }
    if (!/\.(?:js|jsx|ts|tsx)$/.test(extname(path))) continue
    if (/\.(?:test|spec)\.[^.]+$/.test(name)) continue
    sources.push({ path: relative(adminDir, path), code: readFileSync(path, 'utf8') })
  }
  return sources
}

const result = analyzeI18n({
  vi: readJson('vi.json'),
  en: readJson('en.json'),
  sourceFiles: collectSources(sourceDir),
})

if (result.errors.length) {
  console.error(`\n❌ i18n guard found ${result.errors.length} problem(s).`)
  result.errors.forEach((item) => {
    if (item.type.startsWith('locale-')) {
      console.error(`  - ${item.type}: ${item.key}`)
    } else if (item.type === 'source-parse-error') {
      console.error(`  - ${item.type}: ${item.file}: ${item.message}`)
    } else {
      const location = `${item.file}:${item.line}:${item.column + 1}`
      const detail = item.key || item.expression || item.message
      console.error(`  - ${item.type}: ${location}${detail ? ` — ${detail}` : ''}`)
    }
  })
  process.exit(1)
}

console.log(
  `✅ i18n guard passed: ${result.viKeys.size} keys in each locale; ${result.stats.callCount} translation calls checked (${result.stats.staticCallCount} static, ${result.stats.dynamicCallCount} dynamic) across ${result.stats.sourceFiles} production source files.`,
)
