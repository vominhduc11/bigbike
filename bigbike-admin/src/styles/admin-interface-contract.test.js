import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const ROOT = resolve('.')
const screen = (name) => readFileSync(join(ROOT, 'src', 'screens', `${name}.jsx`), 'utf8')

function walkFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return walkFiles(path, predicate)
    return predicate(path) ? [path] : []
  })
}

const productionJsxFiles = () => walkFiles(join(ROOT, 'src'), (path) => (
  path.endsWith('.jsx') && !path.includes('.test.') && !path.includes('.spec.')
))

const COLUMN_VISIBILITY_SCREENS = [
  'ProductListScreen',
  'CategoryListScreen',
  'ContentListScreen',
  'BrandListScreen',
  'OrderListScreen',
  'CustomerListScreen',
  'ReviewListScreen',
  'RedirectListScreen',
  'AdminUsersScreen',
  'AuditLogListScreen',
  'ChatConversationListScreen',
  'LegacyDiscontinuedProductsScreen',
  'MenuScreen',
]

const STATUS_RAIL_SCREENS = [
  'ProductListScreen',
  'CategoryListScreen',
  'ContentListScreen',
  'BrandListScreen',
  'OrderListScreen',
  'CustomerListScreen',
  'ReviewListScreen',
  'RedirectListScreen',
  'AdminUsersScreen',
  'LegacyDiscontinuedProductsScreen',
]

const BULK_SCREENS = [
  'CategoryListScreen.jsx',
  'ContentListScreen.jsx',
  'HomeVideoListScreen.jsx',
  'MediaLibraryScreen.jsx',
  'MenuScreen.jsx',
  'OrderListScreen.jsx',
  'ProductListScreen.jsx',
  'RedirectListScreen.jsx',
  'ReviewListScreen.jsx',
]

describe('admin interface composition contract', () => {
  test.each(COLUMN_VISIBILITY_SCREENS)('%s supports persisted column visibility', (name) => {
    expect(screen(name)).toContain('ColumnVisibilityToggle')
    expect(screen(name)).toContain('useColumnVisibility')
  })

  test.each(STATUS_RAIL_SCREENS)('%s renders a semantic row accent', (name) => {
    expect(screen(name)).toMatch(/RowAccent|rowClassName|bb-row-accent/)
  })

  test('bulk actions remain limited to screens with real bulk operations', () => {
    const screenDir = join(ROOT, 'src', 'screens')
    const actual = readdirSync(screenDir)
      .filter((name) => name.endsWith('Screen.jsx'))
      .filter((name) => readFileSync(join(screenDir, name), 'utf8').includes('<BulkActionBar'))
      .sort()
    expect(actual).toEqual([...BULK_SCREENS].sort())
  })

  test('removed composition primitives cannot be reintroduced by accident', () => {
    expect(existsSync(join(ROOT, 'src', 'components', 'SectionCard.jsx'))).toBe(false)
    expect(existsSync(join(ROOT, 'src', 'components', 'MediaCardSkeleton.jsx'))).toBe(false)

    const screenDir = join(ROOT, 'src', 'screens')
    const source = readdirSync(screenDir)
      .filter((name) => name.endsWith('.jsx'))
      .map((name) => readFileSync(join(screenDir, name), 'utf8'))
      .join('\n')

    expect(source).not.toContain('<SectionCard')
    expect(source).not.toContain('<MediaCardSkeleton')
    expect(source).not.toContain('bb-card-header')
    expect(source).not.toContain('maxWidth=')
    expect(source).not.toContain('bb-skel')
  })

  test('every routed content screen uses the shared Screen wrapper', () => {
    const intentionallyUnwrapped = new Set([
      // Auth screens use their own full-viewport shell; these are not AdminShell content routes.
      'AcceptInviteScreen.jsx',
      'LoginScreen.jsx',
      // Embedded settings panels; the parent SettingsScreen owns the one page-level Screen.
      'AssignmentRolesScreen.jsx',
      'BannerScreen.jsx',
    ])
    const screenDir = join(ROOT, 'src', 'screens')
    const missing = readdirSync(screenDir)
      .filter((name) => name.endsWith('Screen.jsx') && !intentionallyUnwrapped.has(name))
      .filter((name) => !/<Screen(?:\s|>)/.test(readFileSync(join(screenDir, name), 'utf8')))

    expect(missing).toEqual([])
  })

  test('legacy content UI system is fully removed from nested production components', () => {
    const forbidden = /\bbb-(?:card(?:-header|-body)?|filter-bar|table(?:-wrap)?|btn(?:-primary|-secondary|-ghost|-sm)?|input|select|icon-btn|foldable)\b/
    const offenders = productionJsxFiles()
      .filter((path) => forbidden.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(`${ROOT}\\`, ''))

    expect(offenders).toEqual([])

    const legacyCss = readFileSync(join(ROOT, 'src', 'styles', 'admin-prototype.css'), 'utf8')
    expect(legacyCss).not.toMatch(/\.bb-(?:card|filter-bar|table|btn|input|select|icon-btn|foldable)\b/)
  })

  test('all production data tables are composed through AdminTable', () => {
    const rawTables = productionJsxFiles()
      .filter((path) => !path.endsWith(join('components', 'ui', 'table.jsx')))
      .filter((path) => /<table(?:\s|>)/.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(`${ROOT}\\`, ''))

    expect(rawTables).toEqual([])
    for (const name of ['CategoryListScreen', 'DashboardScreen', 'MenuScreen', 'OrderDetailScreen']) {
      expect(screen(name)).toContain('<AdminTable')
    }
  })

  test('spacing uses the documented 4px token rhythm', () => {
    const halfStep = /\b(?:gap|space-[xy]|p[trblxy]?|m[trblxy]?)-\d+\.5\b/
    const halfStepOffenders = productionJsxFiles()
      .filter((path) => halfStep.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(`${ROOT}\\`, ''))
    expect(halfStepOffenders).toEqual([])

    const cssFiles = [
      join(ROOT, 'src', 'index.css'),
      ...walkFiles(join(ROOT, 'src', 'styles'), (path) => path.endsWith('.css')),
    ]
    const hardcodedSpacing = cssFiles.flatMap((path) => {
      const css = readFileSync(path, 'utf8')
      const declarations = css.match(/(?:padding|margin|gap|row-gap|column-gap|scroll-margin)(?:-[a-z]+)*\s*:\s*[^;]+;/g) ?? []
      return declarations.filter((declaration) => /\b\d+px\b/.test(declaration)).map((declaration) => ({ path, declaration }))
    })
    expect(hardcodedSpacing).toEqual([])
  })

  test('Screen delegates width entirely to the 1700px outer shell', () => {
    const screenComponent = readFileSync(join(ROOT, 'src', 'components', 'layout', 'Screen.jsx'), 'utf8')
    const tokens = readFileSync(join(ROOT, 'src', 'styles', 'admin-tokens.css'), 'utf8')
    expect(screenComponent).not.toContain('maxWidth')
    expect(tokens).toMatch(/--bb-content-max:\s*1700px/)
  })
})
