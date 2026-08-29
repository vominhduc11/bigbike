// Permission catalog, label map and pure helpers for RolesScreen.
// Extracted from RolesScreen.jsx to keep the screen file focused on behaviour.

// Fallback catalog used when the backend /admin/permissions API is unavailable.
// Keep in sync with PermissionCatalog.java groups.
export const BUILTIN_CATALOG = [
  {
    groupKey: 'roles.groupSales',
    permissions: [
      perm('orders.read', 'orders', 'READ'),
      perm('orders.write', 'orders', 'WRITE', false, ['orders.read']),
      perm('customers.read', 'customers', 'READ'),
      perm('customers.write', 'customers', 'WRITE', false, ['customers.read']),
      perm('reviews.read', 'reviews', 'READ'),
      perm('reviews.write', 'reviews', 'WRITE', false, ['reviews.read']),
      perm('reports.read', 'reports', 'READ'),
      perm('reports.export', 'reports', 'EXPORT', true, ['reports.read']),
    ],
  },
  {
    groupKey: 'roles.groupProducts',
    permissions: [
      perm('products.read', 'products', 'READ'),
      perm('products.update', 'products', 'WRITE', false, ['products.read', 'catalog.read']),
      perm('catalog.read', 'catalog', 'READ'),
      perm('catalog.update', 'catalog', 'WRITE', false, ['catalog.read']),
      perm('inventory.read', 'inventory', 'SUPPORTING'),
    ],
  },
  {
    groupKey: 'roles.groupContent',
    permissions: [
      perm('content.read', 'content', 'READ'),
      perm('content.update', 'content', 'WRITE', false, ['content.read']),
      perm('media.read', 'media', 'READ'),
      perm('media.write', 'media', 'WRITE', false, ['media.read']),
      perm('menus.read', 'menus', 'READ'),
      perm('menus.write', 'menus', 'WRITE', false, ['menus.read']),
      perm('sliders.read', 'sliders', 'READ'),
      perm('sliders.write', 'sliders', 'WRITE', false, ['sliders.read']),
      perm('home_videos.read', 'home_videos', 'READ'),
      perm('home_videos.write', 'home_videos', 'WRITE', false, ['home_videos.read']),
      perm('home_highlights.read', 'home_highlights', 'READ'),
      perm('home_highlights.write', 'home_highlights', 'WRITE', false, ['home_highlights.read', 'products.read']),
      perm('redirects.read', 'redirects', 'READ'),
      perm('redirects.write', 'redirects', 'WRITE', false, ['redirects.read']),
      // V372 cấp cho ADMIN/EDITOR. Thiếu ở đây thì màn Vai trò gửi lên một key mà backend
      // không nhận ra → lưu ADMIN/EDITOR là lỗi 400 UNKNOWN_PERMISSION.
      perm('seo.index', 'seo', 'WRITE', true),
    ],
  },
  {
    groupKey: 'roles.groupSystem',
    permissions: [
      perm('settings.read', 'settings', 'READ'),
      perm('settings.write', 'settings', 'WRITE', true, ['settings.read']),
      perm('admin-users.read', 'admin-users', 'READ'),
      perm('admin-users.write', 'admin-users', 'WRITE', true, ['admin-users.read', 'roles.read']),
      perm('roles.read', 'roles', 'READ'),
      perm('roles.write', 'roles', 'WRITE', true, ['roles.read']),
      perm('audit-logs.read', 'audit-logs', 'READ', true),
      perm('chat.read', 'chat', 'READ', true),
      perm('chat.reply', 'chat', 'WRITE', true, ['chat.read']),
      // V375. Giữ quyền này KHÔNG đủ để bật/tắt bảo trì — endpoint còn đòi đúng vai trò
      // DEVELOPER, vì quyền '*' của Chủ hệ thống thoả mãn mọi permission. Cấp cho vai trò
      // khác sẽ không có tác dụng; nhãn hiển thị đã nói rõ điều đó.
      perm('maintenance.manage', 'maintenance', 'WRITE', true),
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
  'seo.index':                  'roles.permSeoIndex',
  'settings.read':              'roles.permSettingsRead',
  'settings.write':             'roles.permSettingsWrite',
  'admin-users.read':           'roles.permAdminUsersRead',
  'admin-users.write':          'roles.permAdminUsersWrite',
  'roles.read':                 'roles.permRolesRead',
  'roles.write':                'roles.permRolesWrite',
  'audit-logs.read':            'roles.permAuditLogsRead',
  'chat.read':                  'roles.permChatRead',
  'chat.reply':                 'roles.permChatReply',
  'maintenance.manage':         'roles.permMaintenanceManage',
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
  const entriesByKey = new Map(catalog.flatMap(g => g.permissions).map(p => [p.key, p]))
  return { knownKeys, sensitiveKeys, entriesByKey }
}

export const MODULE_LABELS = {
  orders: 'Đơn hàng',
  customers: 'Khách hàng',
  reviews: 'Đánh giá',
  reports: 'Báo cáo',
  products: 'Sản phẩm',
  catalog: 'Danh mục & thương hiệu',
  inventory: 'Tồn kho hỗ trợ Dashboard',
  content: 'Nội dung',
  media: 'Thư viện ảnh/video',
  menus: 'Menu',
  sliders: 'Banner',
  home_videos: 'Video trang chủ',
  home_highlights: 'Điểm nhấn trang chủ',
  redirects: 'Chuyển hướng',
  seo: 'Hiển thị trên Google',
  settings: 'Cài đặt',
  'admin-users': 'Tài khoản quản trị',
  roles: 'Vai trò & phân quyền',
  'audit-logs': 'Nhật ký hoạt động',
  maintenance: 'Bảo trì hệ thống',
}

export function closePermissionDependencies(inputPermissions, catalog) {
  const { entriesByKey } = buildCatalogHelpers(catalog)
  const permissions = new Set(inputPermissions)
  const autoAdded = new Map()
  const queue = [...permissions].map((key) => ({ key, requiredBy: key }))

  while (queue.length > 0) {
    const current = queue.shift()
    const entry = entriesByKey.get(current.key)
    for (const required of entry?.requires || []) {
      if (!permissions.has(required)) {
        permissions.add(required)
        autoAdded.set(required, new Set([current.requiredBy]))
        queue.push({ key: required, requiredBy: current.requiredBy })
      } else if (autoAdded.has(required)) {
        autoAdded.get(required).add(current.requiredBy)
      }
    }
  }
  return { permissions, autoAdded }
}

export function dependentClosure(permission, activePermissions, catalog) {
  const { entriesByKey } = buildCatalogHelpers(catalog)
  const removed = new Set([permission])
  let changed = true
  while (changed) {
    changed = false
    for (const active of activePermissions) {
      if (removed.has(active)) continue
      const requires = entriesByKey.get(active)?.requires || []
      if (requires.some(required => removed.has(required))) {
        removed.add(active)
        changed = true
      }
    }
  }
  return removed
}

export function requiredBy(permission, activePermissions, catalog) {
  const { entriesByKey } = buildCatalogHelpers(catalog)
  return [...activePermissions].filter(active =>
    (entriesByKey.get(active)?.requires || []).includes(permission)
  )
}

export function groupCatalogByModule(catalog) {
  const modules = new Map()
  for (const entry of catalog.flatMap(group => group.permissions || [])) {
    const moduleKey = entry.moduleKey || entry.key.split('.')[0]
    if (!modules.has(moduleKey)) {
      modules.set(moduleKey, {
        groupKey: `roles.module.${moduleKey}`,
        moduleKey,
        permissions: [],
      })
    }
    modules.get(moduleKey).permissions.push({
      ...entry,
      moduleKey,
      kind: entry.kind || (entry.key.endsWith('.read') ? 'READ' : 'WRITE'),
      requires: Array.isArray(entry.requires) ? entry.requires : [],
    })
  }
  return [...modules.values()]
}

function perm(key, moduleKey, kind, sensitive = false, requires = []) {
  return { key, moduleKey, kind, sensitive, requires }
}

export function formatRoleName(id) {
  if (!id) return ''
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function getRoleDisplayName(role, t) {
  return t(`roles.roleLabel_${role.id}`, { defaultValue: role.name || t('common.unknown') })
}

export function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
