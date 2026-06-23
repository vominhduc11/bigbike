// Permission catalog, label map and pure helpers for RolesScreen.
// Extracted from RolesScreen.jsx to keep the screen file focused on behaviour.

// Fallback catalog used when the backend /admin/permissions API is unavailable.
// Keep in sync with PermissionCatalog.java groups.
export const BUILTIN_CATALOG = [
  {
    groupKey: 'roles.groupSales',
    permissions: [
      { key: 'orders.read',                  sensitive: false },
      { key: 'orders.write',                 sensitive: false },
      { key: 'customers.read',               sensitive: false },
      { key: 'customers.write',              sensitive: false },
      { key: 'reviews.read',                 sensitive: false },
      { key: 'reviews.write',                sensitive: false },
      { key: 'reports.read',                 sensitive: false },
      { key: 'reports.export',               sensitive: false },
    ],
  },
  {
    groupKey: 'roles.groupProducts',
    permissions: [
      { key: 'products.read',    sensitive: false },
      { key: 'products.update',  sensitive: false },
      { key: 'catalog.read',     sensitive: false },
      { key: 'catalog.update',   sensitive: false },
      { key: 'inventory.read',   sensitive: false },
      { key: 'inventory.write',  sensitive: false },
    ],
  },
  {
    groupKey: 'roles.groupContent',
    permissions: [
      { key: 'content.read',      sensitive: false },
      { key: 'content.update',    sensitive: false },
      { key: 'media.read',        sensitive: false },
      { key: 'media.write',       sensitive: false },
      { key: 'menus.read',        sensitive: false },
      { key: 'menus.write',       sensitive: false },
      { key: 'sliders.read',      sensitive: false },
      { key: 'sliders.write',     sensitive: false },
      { key: 'home_videos.read',  sensitive: false },
      { key: 'home_videos.write', sensitive: false },
      { key: 'home_highlights.read',  sensitive: false },
      { key: 'home_highlights.write', sensitive: false },
      { key: 'redirects.read',    sensitive: false },
      { key: 'redirects.write',   sensitive: false },
    ],
  },
  {
    groupKey: 'roles.groupSystem',
    permissions: [
      { key: 'settings.read',     sensitive: false },
      { key: 'settings.write',    sensitive: true  },
      { key: 'admin-users.read',  sensitive: false },
      { key: 'admin-users.write', sensitive: true  },
      { key: 'roles.read',        sensitive: false },
      { key: 'roles.write',       sensitive: true  },
      { key: 'audit-logs.read',   sensitive: true  },
    ],
  },
]

// i18n label key map — covers all keys from PermissionCatalog.GROUPS
export const PERM_LABEL_KEY_MAP = {
  'orders.read':                'roles.permOrdersRead',
  'orders.write':               'roles.permOrdersWrite',
  'customers.read':             'roles.permCustomersRead',
  'customers.write':            'roles.permCustomersWrite',
  'reviews.read':               'roles.permReviewsRead',
  'reviews.write':              'roles.permReviewsWrite',
  'reports.read':               'roles.permReportsRead',
  'reports.export':             'roles.permReportsExport',
  'products.read':              'roles.permProductsRead',
  'products.update':            'roles.permProductsUpdate',
  'catalog.read':               'roles.permCatalogRead',
  'catalog.update':             'roles.permCatalogUpdate',
  'inventory.read':             'roles.permInventoryRead',
  'inventory.write':            'roles.permInventoryWrite',
  'content.read':               'roles.permContentRead',
  'content.update':             'roles.permContentUpdate',
  'media.read':                 'roles.permMediaRead',
  'media.write':                'roles.permMediaWrite',
  'menus.read':                 'roles.permMenusRead',
  'menus.write':                'roles.permMenusWrite',
  'sliders.read':               'roles.permSlidersRead',
  'sliders.write':              'roles.permSlidersWrite',
  'home_videos.read':           'roles.permHomeVideosRead',
  'home_videos.write':          'roles.permHomeVideosWrite',
  'home_highlights.read':       'roles.permHomeHighlightsRead',
  'home_highlights.write':      'roles.permHomeHighlightsWrite',
  'redirects.read':             'roles.permRedirectsRead',
  'redirects.write':            'roles.permRedirectsWrite',
  'settings.read':              'roles.permSettingsRead',
  'settings.write':             'roles.permSettingsWrite',
  'admin-users.read':           'roles.permAdminUsersRead',
  'admin-users.write':          'roles.permAdminUsersWrite',
  'roles.read':                 'roles.permRolesRead',
  'roles.write':                'roles.permRolesWrite',
  'audit-logs.read':            'roles.permAuditLogsRead',
}

// Permissions an admin must never be able to strip from their OWN role —
// removing these would lock them out of role management entirely.
export const SELF_PROTECTED_PERMS = new Set(['roles.read', 'roles.write'])

// Derived from catalog; rebuilt whenever catalog changes.
export function buildCatalogHelpers(catalog) {
  const knownKeys = new Set(catalog.flatMap(g => g.permissions.map(p => p.key)))
  const sensitiveKeys = new Set(
    catalog.flatMap(g => g.permissions.filter(p => p.sensitive).map(p => p.key))
  )
  return { knownKeys, sensitiveKeys }
}

export function formatRoleName(id) {
  if (!id) return ''
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function getRoleDisplayName(role, t) {
  return t(`roles.roleLabel_${role.id}`, { defaultValue: role.name || formatRoleName(role.id) })
}

export function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
