/**
 * Canonical access registry for admin navigation, route guards and actions.
 *
 * `allOf` is the normal RBAC contract. `anyOf` is supported for explicitly
 * documented exceptions only; it must never be used to make a write-only role
 * look like it can read a module.
 */
export const ADMIN_ACCESS_POLICIES = Object.freeze({
  dashboard: policy(['orders.read'], { readPermission: 'orders.read', supporting: ['inventory.read'] }),

  productsRead: policy(['products.read'], { readPermission: 'products.read', writePermission: 'products.update' }),
  productsWrite: policy(['products.read', 'products.update', 'catalog.read'], {
    readPermission: 'products.read',
    writePermission: 'products.update',
    supporting: ['catalog.read', 'media.read', 'media.write'],
  }),
  featuredProducts: policy(['products.read', 'products.update'], {
    readPermission: 'products.read',
    writePermission: 'products.update',
  }),
  catalogRead: policy(['catalog.read'], { readPermission: 'catalog.read', writePermission: 'catalog.update' }),
  catalogWrite: policy(['catalog.read', 'catalog.update'], {
    readPermission: 'catalog.read',
    writePermission: 'catalog.update',
  }),
  contentRead: policy(['content.read'], { readPermission: 'content.read', writePermission: 'content.update' }),
  contentWrite: policy(['content.read', 'content.update'], {
    readPermission: 'content.read',
    writePermission: 'content.update',
    supporting: ['media.read', 'media.write'],
  }),

  ordersRead: policy(['orders.read'], { readPermission: 'orders.read', writePermission: 'orders.write' }),
  ordersWrite: policy(['orders.read', 'orders.write']),
  customersRead: policy(['customers.read'], { readPermission: 'customers.read', writePermission: 'customers.write' }),
  customersWrite: policy(['customers.read', 'customers.write']),
  reviewsRead: policy(['reviews.read'], { readPermission: 'reviews.read', writePermission: 'reviews.write' }),
  reviewsWrite: policy(['reviews.read', 'reviews.write']),
  chatRead: policy(['chat.read'], { readPermission: 'chat.read' }),

  mediaRead: policy(['media.read'], { readPermission: 'media.read', writePermission: 'media.write' }),
  mediaWrite: policy(['media.read', 'media.write']),
  menusRead: policy(['menus.read'], { readPermission: 'menus.read', writePermission: 'menus.write', supporting: ['catalog.read'] }),
  menusWrite: policy(['menus.read', 'menus.write']),
  slidersRead: policy(['sliders.read'], { readPermission: 'sliders.read', writePermission: 'sliders.write' }),
  slidersWrite: policy(['sliders.read', 'sliders.write']),
  slidersFullEdit: policy(['sliders.read', 'sliders.write', 'products.read', 'media.read'], {
    readPermission: 'sliders.read',
    writePermission: 'sliders.write',
    supporting: ['products.read', 'media.read', 'media.write'],
  }),
  homeVideosRead: policy(['home_videos.read'], {
    readPermission: 'home_videos.read',
    writePermission: 'home_videos.write',
    supporting: ['media.read', 'media.write'],
  }),
  homeVideosWrite: policy(['home_videos.read', 'home_videos.write']),
  homeHighlightsRead: policy(['home_highlights.read'], {
    readPermission: 'home_highlights.read',
    writePermission: 'home_highlights.write',
    supporting: ['products.read'],
  }),
  homeHighlightsWrite: policy(['home_highlights.read', 'home_highlights.write', 'products.read']),
  redirectsRead: policy(['redirects.read'], { readPermission: 'redirects.read', writePermission: 'redirects.write' }),
  redirectsWrite: policy(['redirects.read', 'redirects.write']),

  reportsRead: policy(['reports.read'], { readPermission: 'reports.read', writePermission: 'reports.export' }),
  reportsExport: policy(['reports.read', 'reports.export']),
  settingsRead: policy(['settings.read'], { readPermission: 'settings.read', writePermission: 'settings.write' }),
  settingsWrite: policy(['settings.read', 'settings.write']),
  adminUsersRead: policy(['admin-users.read'], {
    readPermission: 'admin-users.read',
    writePermission: 'admin-users.write',
    supporting: ['roles.read'],
  }),
  adminUsersWrite: policy(['admin-users.read', 'admin-users.write']),
  adminUsersAssignRole: policy(['admin-users.read', 'admin-users.write', 'roles.read']),
  rolesRead: policy(['roles.read'], { readPermission: 'roles.read', writePermission: 'roles.write' }),
  rolesWrite: policy(['roles.read', 'roles.write']),
  auditLogsRead: policy(['audit-logs.read'], { readPermission: 'audit-logs.read' }),
})

export const ROUTE_POLICY_KEYS = Object.freeze({
  dashboard: 'dashboard',
  'products-list': 'productsRead',
  'legacy-discontinued-products': 'productsRead',
  'product-detail': 'productsRead',
  'product-create': 'productsWrite',
  'categories-list': 'catalogRead',
  'category-detail': 'catalogRead',
  'category-create': 'catalogWrite',
  'brands-list': 'catalogRead',
  'brand-detail': 'catalogRead',
  'brand-create': 'catalogWrite',
  'featured-products': 'featuredProducts',
  'content-list': 'contentRead',
  'content-detail': 'contentRead',
  'content-create': 'contentWrite',
  'orders-list': 'ordersRead',
  'order-detail': 'ordersRead',
  'customers-list': 'customersRead',
  'customer-detail': 'customersRead',
  reviews: 'reviewsRead',
  'review-detail': 'reviewsRead',
  'chat-conversations': 'chatRead',
  'chat-conversation-detail': 'chatRead',
  'media-library': 'mediaRead',
  menus: 'menusRead',
  sliders: 'slidersRead',
  'home-videos': 'homeVideosRead',
  'home-highlights': 'homeHighlightsRead',
  redirects: 'redirectsRead',
  reports: 'reportsRead',
  settings: 'settingsRead',
  'admin-users': 'adminUsersRead',
  roles: 'rolesRead',
  'audit-logs': 'auditLogsRead',
})

export function canAccessPolicy(policyKeyOrPolicy, hasPermission) {
  const accessPolicy = resolvePolicy(policyKeyOrPolicy)
  if (!accessPolicy) return false
  const hasAll = accessPolicy.allOf.every(hasPermission)
  const hasAny = accessPolicy.anyOf.length === 0 || accessPolicy.anyOf.some(hasPermission)
  return hasAll && hasAny
}

export function missingPolicyPermissions(policyKeyOrPolicy, hasPermission) {
  const accessPolicy = resolvePolicy(policyKeyOrPolicy)
  if (!accessPolicy) return []
  const missing = accessPolicy.allOf.filter((permission) => !hasPermission(permission))
  if (accessPolicy.anyOf.length > 0 && !accessPolicy.anyOf.some(hasPermission)) {
    missing.push(`Một trong: ${accessPolicy.anyOf.join(', ')}`)
  }
  return missing
}

export function policyForRoute(routeName) {
  return ROUTE_POLICY_KEYS[routeName] || null
}

function resolvePolicy(policyKeyOrPolicy) {
  if (!policyKeyOrPolicy) return null
  if (typeof policyKeyOrPolicy === 'string') return ADMIN_ACCESS_POLICIES[policyKeyOrPolicy] || null
  return policyKeyOrPolicy
}

function policy(allOf, metadata = {}) {
  return Object.freeze({
    allOf: Object.freeze([...allOf]),
    anyOf: Object.freeze([...(metadata.anyOf || [])]),
    readPermission: metadata.readPermission || null,
    writePermission: metadata.writePermission || null,
    supporting: Object.freeze([...(metadata.supporting || [])]),
  })
}
