import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(projectRoot, '..')

const scanTargets = [
  path.join(projectRoot, 'src'),
  path.join(projectRoot, 'Dockerfile'),
  path.join(projectRoot, 'README.md'),
  path.join(repoRoot, 'docker-compose.yaml'),
]

const sourceExtensions = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.md',
  '.yaml',
  '.yml',
])

const allowedFixturePath = /(^|[/\\])(__tests__|tests?|fixtures?)([/\\]|$)|\.(test|spec)\.[cm]?[jt]sx?$/

const forbiddenPatterns = [
  { pattern: /VITE_USE_ADMIN_MOCK/g, reason: 'old admin mock build flag' },
  { pattern: /withMockFallback/g, reason: 'runtime mock fallback helper' },
  { pattern: /\bmockData\b/g, reason: 'runtime mock data module' },
  { pattern: /\bqueryMock[A-Za-z0-9_]*\b/g, reason: 'runtime mock query helper' },
  { pattern: /\bgetMock[A-Za-z0-9_]*\b/g, reason: 'runtime mock getter' },
  { pattern: /\bbuildMock[A-Za-z0-9_]*\b/g, reason: 'runtime mock builder' },
  { pattern: /\bmockReturns\b/g, reason: 'inline return mock data' },
  { pattern: /\bisMock\b/g, reason: 'runtime mock result flag' },
  { pattern: /mode\s*===\s*['"]mock['"]/g, reason: 'runtime mock mode branch' },
]

function collectFiles(target) {
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]

  const files = []
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const fullPath = path.join(target, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue
      files.push(...collectFiles(fullPath))
      continue
    }
    if (!entry.isFile()) continue
    if (sourceExtensions.has(path.extname(entry.name)) || entry.name === 'Dockerfile') {
      files.push(fullPath)
    }
  }
  return files
}

const findings = []

for (const target of scanTargets) {
  for (const file of collectFiles(target)) {
    const rel = path.relative(repoRoot, file)
    if (allowedFixturePath.test(rel)) continue
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)

    for (const { pattern, reason } of forbiddenPatterns) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        const lineNumber = text.slice(0, match.index).split(/\r?\n/).length
        findings.push({
          file: rel,
          line: lineNumber,
          token: match[0],
          reason,
          source: lines[lineNumber - 1]?.trim() ?? '',
        })
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Admin runtime mock guard failed.\n')
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.reason}: ${finding.token}`)
    console.error(`  ${finding.source}`)
  }
  process.exit(1)
}

console.log('Admin runtime mock guard passed.')
