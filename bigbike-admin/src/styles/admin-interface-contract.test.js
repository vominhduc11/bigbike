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

const RESPONSIVE_FILTER_SCREENS = [
  'AdminUsersScreen',
  'BrandListScreen',
  'CategoryListScreen',
  'ChatConversationListScreen',
  'ContentListScreen',
  'CustomerListScreen',
  'LegacyDiscontinuedProductsScreen',
  'MediaLibraryScreen',
  'OrderListScreen',
  'ProductListScreen',
  'RedirectListScreen',
  'ReviewListScreen',
]

const DENSITY_SCREENS = [
  'AdminUsersScreen',
  'AuditLogListScreen',
  'BrandListScreen',
  'CategoryListScreen',
  'ChatConversationListScreen',
  'ContentListScreen',
  'CustomerListScreen',
  'LegacyDiscontinuedProductsScreen',
  'MenuScreen',
  'OrderListScreen',
  'ProductListScreen',
  'RedirectListScreen',
  'ReviewListScreen',
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

  test('every page header uses one of the five sidebar groups without legacy eyebrow props', () => {
    const allowedGroups = new Set(['sales', 'products', 'content', 'reports', 'system'])
    const headers = productionJsxFiles().flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return [...source.matchAll(/<ScreenHeader\b([\s\S]*?)(?:\/>|>)/g)].map((match) => ({
        path,
        props: match[1],
      }))
    })

    expect(headers).toHaveLength(32)
    for (const header of headers) {
      const group = /\bgroup="([^"]+)"/.exec(header.props)?.[1]
      expect(allowedGroups.has(group), header.path).toBe(true)
      expect(header.props, header.path).not.toMatch(/\beyebrow=/)
    }

    const visibleDescriptions = headers.filter(({ props }) => /\bdescription=/.test(props))
    expect(visibleDescriptions.length).toBeLessThanOrEqual(8)
  })

  test('the longest audit helpers are rendered through shared progressive help', () => {
    const sourceByFile = {
      ProductDetailScreen: screen('ProductDetailScreen'),
      CategoryDetailScreen: screen('CategoryDetailScreen'),
      ContentDetailScreen: screen('ContentDetailScreen'),
      ContentEditors: readFileSync(join(ROOT, 'src', 'screens', 'product-detail', 'ContentEditors.jsx'), 'utf8'),
      blocks: readFileSync(join(ROOT, 'src', 'components', 'block-editor', 'blocks.jsx'), 'utf8'),
    }
    const progressiveHelp = [
      ['ProductDetailScreen', 'products.detail.specStats.hint'],
      ['ProductDetailScreen', 'products.detail.commitments.hint'],
      ['ContentEditors', 'products.detail.highlights.htmlHint'],
      ['ContentDetailScreen', 'content.detail.homeExperienceHint'],
      ['ContentEditors', 'products.detail.faqs.htmlHint'],
      ['CategoryDetailScreen', 'categories.introContentHint'],
      ['blocks', 'products.detail.sizeGuide.htmlHint'],
    ]

    for (const [file, key] of progressiveHelp) {
      const source = sourceByFile[file]
      const keyIndex = source.indexOf(key)
      expect(keyIndex, `${file}: ${key}`).toBeGreaterThan(-1)
      const context = source.slice(Math.max(0, keyIndex - 180), keyIndex + key.length + 180)
      expect(context, `${file}: ${key}`).toMatch(/(?:description=|HelpTooltip)/)
    }
  })

  test('all data lists with row operations use the shared row-action pattern', () => {
    for (const name of [
      'ProductListScreen',
      'BrandListScreen',
      'ContentListScreen',
      'CategoryListScreen',
      'RedirectListScreen',
      'ReviewListScreen',
      'AdminUsersScreen',
      'LegacyDiscontinuedProductsScreen',
    ]) {
      expect(screen(name)).toContain('<TableRowActions')
    }
    const menuRow = readFileSync(join(ROOT, 'src', 'screens', 'menu', 'SortableMenuItem.jsx'), 'utf8')
    expect(menuRow).toContain('<TableRowActions')
  })

  test.each(RESPONSIVE_FILTER_SCREENS)('%s collapses its filters through the shared mobile drawer', (name) => {
    expect(screen(name)).toContain('<ResponsiveFilterBar')
  })

  test('the audit log keeps its draft-and-apply drawer on mobile', () => {
    expect(screen('AuditLogListScreen')).toContain('<MobileFilterDrawer')
    const drawer = readFileSync(join(ROOT, 'src', 'screens', 'audit-log-list', 'MobileFilterDrawer.jsx'), 'utf8')
    expect(drawer).toContain('MobileFilterDrawerShell')
  })

  test('every operational list is readable as cards on mobile', () => {
    const listScreens = [
      'AdminUsersScreen', 'AuditLogListScreen', 'BrandListScreen', 'CategoryListScreen',
      'ChatConversationListScreen', 'ContentListScreen', 'CustomerListScreen',
      'LegacyDiscontinuedProductsScreen', 'MenuScreen', 'OrderListScreen',
      'ProductListScreen', 'RedirectListScreen', 'ReviewListScreen',
    ]
    for (const name of listScreens) {
      expect(screen(name), name).toMatch(/mobileCard=|<MobileCardList/)
    }
  })

  test('every shared data table, including nested tables, has a mobile card alternative', () => {
    const tableFiles = [
      ['src/screens/AdminUsersScreen.jsx', 1],
      ['src/screens/AuditLogListScreen.jsx', 1, true],
      ['src/screens/BrandListScreen.jsx', 1],
      ['src/screens/CategoryListScreen.jsx', 2],
      ['src/screens/ChatConversationListScreen.jsx', 1],
      ['src/screens/ContentListScreen.jsx', 1],
      ['src/screens/CustomerListScreen.jsx', 1],
      ['src/screens/DashboardScreen.jsx', 2],
      ['src/screens/LegacyDiscontinuedProductsScreen.jsx', 1],
      ['src/screens/MenuScreen.jsx', 1],
      ['src/screens/OrderDetailScreen.jsx', 2],
      ['src/screens/OrderListScreen.jsx', 1],
      ['src/screens/ProductListScreen.jsx', 1],
      ['src/screens/RedirectListScreen.jsx', 1],
      ['src/screens/ReportsScreen.jsx', 1],
      ['src/screens/ReviewListScreen.jsx', 1],
      ['src/screens/category-detail/ProductsInCategoryCard.jsx', 1],
      ['src/components/ImportProductsDialog.jsx', 1],
    ]

    for (const [relativePath, expectedTables, usesSeparateMobileList = false] of tableFiles) {
      const source = readFileSync(join(ROOT, relativePath), 'utf8')
      expect(source.match(/<AdminTable/g)?.length, relativePath).toBe(expectedTables)
      if (usesSeparateMobileList) {
        expect(source, relativePath).toContain('<MobileCardList')
      } else {
        expect(source.match(/mobileCard=/g)?.length, relativePath).toBeGreaterThanOrEqual(expectedTables)
      }
    }
  })

  test.each(DENSITY_SCREENS)('%s persists the shared table-density preference', (name) => {
    expect(screen(name)).toContain('densityKey=')
  })

  test('orders default to compact rows while products default to spacious rows', () => {
    expect(screen('OrderListScreen')).toContain('defaultDensity="compact"')
    expect(screen('ProductListScreen')).toContain('defaultDensity="spacious"')
  })

  test('all five long detail sidebars stay visible while the main column scrolls', () => {
    for (const name of ['CategoryDetailScreen', 'CustomerDetailScreen', 'ReviewDetailScreen', 'ChatConversationDetailScreen', 'OrderDetailScreen']) {
      expect(screen(name), name).toContain('lg:sticky lg:top-4')
    }
  })

  test('settings and media use the documented space-filling layouts', () => {
    expect(screen('SettingsScreen')).toContain('grid grid-cols-1 gap-4 lg:grid-cols-4')
    expect(screen('MediaLibraryScreen')).toContain('2xl:grid-cols-6')
    expect(screen('MediaLibraryScreen')).toContain('<DetailSection')
    expect(screen('MediaLibraryScreen')).toContain('<ResponsiveFilterBar')

    const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8')
    expect(css).not.toMatch(/\.mediafolder-|\.medialib-(?:layout|main-col|filter-bar|grid|pagination-row)/)
  })
})
