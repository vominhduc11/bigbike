import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every screen registered with `lazyScreen(factory, 'Name')` must actually export `Name`.
 *
 * `lazyScreen` returns `{ default: m[exportName] }`, so a screen written with `export default`
 * resolves to `undefined` and React throws the unreadable "Minified React error #306". It renders
 * fine in unit tests (which import it directly), so the mismatch only surfaces as a blank crashing
 * screen in production.
 */
describe('lazyScreen registrations in App.jsx', () => {
  const app = readFileSync(resolve(SRC, 'App.jsx'), 'utf8')
  const registrations = [...app.matchAll(
    /lazyScreen\(\s*\(\)\s*=>\s*import\(\s*'([^']+)'\s*\)\s*,\s*'([^']+)'\s*\)/g,
  )].map(([, path, exportName]) => ({ path, exportName }))

  it('finds every registration (guards against the regex silently matching nothing)', () => {
    expect(registrations.length).toBeGreaterThan(20)
  })

  it.each(registrations)('$exportName is a named export of $path', ({ path, exportName }) => {
    const file = resolve(SRC, `${path.replace(/^\.\//, '')}.jsx`)
    expect(existsSync(file), `${file} không tồn tại`).toBe(true)

    const source = readFileSync(file, 'utf8')
    const named = new RegExp(`export\\s+(?:default\\s+)?function\\s+${exportName}\\b`).test(source)
      || new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b`).test(source)
      || new RegExp(`export\\s+const\\s+${exportName}\\b`).test(source)

    expect(named, `${path} phải có "export function ${exportName}"`).toBe(true)
    expect(
      new RegExp(`export\\s+default\\s+function\\s+${exportName}\\b`).test(source),
      `${path} dùng "export default" — lazyScreen đọc theo TÊN nên sẽ nhận undefined`,
    ).toBe(false)
  })
})
