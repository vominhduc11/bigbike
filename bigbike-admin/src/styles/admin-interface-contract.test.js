import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const ROOT = resolve('.')
const screen = (name) => readFileSync(join(ROOT, 'src', 'screens', `${name}.jsx`), 'utf8')

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

  test('Screen delegates width entirely to the 1700px outer shell', () => {
    const screenComponent = readFileSync(join(ROOT, 'src', 'components', 'layout', 'Screen.jsx'), 'utf8')
    const tokens = readFileSync(join(ROOT, 'src', 'styles', 'admin-tokens.css'), 'utf8')
    expect(screenComponent).not.toContain('maxWidth')
    expect(tokens).toMatch(/--bb-content-max:\s*1700px/)
  })
})
