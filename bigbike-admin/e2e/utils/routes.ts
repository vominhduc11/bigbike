/**
 * Admin route catalog — mirrors NAV_GROUP_DEFS + parseRoute() in src/App.jsx.
 *
 * Only index/list + create routes are listed here (no ID needed). Detail-screen
 * routes that require a real entity ID are resolved at runtime from the API in
 * the relevant specs, so we never hard-code production IDs.
 */
export interface AdminRoute {
  /** Path under the SPA, e.g. "/admin/orders". */
  path: string
  /** Stable id used in test titles / snapshot names. */
  id: string
  /** Human label (for reporting only). */
  label: string
  /** Nav group from App.jsx. */
  group: 'sales' | 'products' | 'content' | 'reports' | 'system'
  /** Form/create screens render a long form rather than a list. */
  kind: 'list' | 'form' | 'dashboard' | 'workspace'
}

export const LIST_ROUTES: AdminRoute[] = [
  // ── sales ───────────────────────────────────────────────
  { path: '/admin/dashboard',               id: 'dashboard',           label: 'Tổng quan',                group: 'sales',    kind: 'dashboard' },
  { path: '/admin/orders',                  id: 'orders',              label: 'Đơn hàng',                 group: 'sales',    kind: 'list' },
  { path: '/admin/customers',               id: 'customers',           label: 'Khách hàng',               group: 'sales',    kind: 'list' },
  { path: '/admin/reviews',                 id: 'reviews',             label: 'Đánh giá',                 group: 'sales',    kind: 'list' },
  // ── products ────────────────────────────────────────────
  { path: '/admin/products',                id: 'products',            label: 'Sản phẩm',                 group: 'products', kind: 'list' },
  { path: '/admin/featured-products',       id: 'featured-products',   label: 'Sản phẩm nổi bật',         group: 'products', kind: 'workspace' },
  { path: '/admin/categories',              id: 'categories',          label: 'Danh mục',                 group: 'products', kind: 'list' },
  { path: '/admin/brands',                  id: 'brands',              label: 'Thương hiệu',              group: 'products', kind: 'list' },
  // ── content ─────────────────────────────────────────────
  { path: '/admin/content',                 id: 'content',             label: 'Nội dung',                 group: 'content',  kind: 'list' },
  { path: '/admin/sliders',                 id: 'sliders',             label: 'Slider',                   group: 'content',  kind: 'list' },
  { path: '/admin/home-videos',             id: 'home-videos',         label: 'Video trang chủ',          group: 'content',  kind: 'list' },
  { path: '/admin/home-highlights',         id: 'home-highlights',     label: 'Khối nổi bật trang chủ',   group: 'content',  kind: 'workspace' },
  { path: '/admin/redirects',               id: 'redirects',           label: 'Redirect',                 group: 'content',  kind: 'list' },
  { path: '/admin/menus',                   id: 'menus',               label: 'Menu',                     group: 'content',  kind: 'workspace' },
  { path: '/admin/media',                   id: 'media',               label: 'Thư viện media',           group: 'content',  kind: 'workspace' },
  // ── reports ─────────────────────────────────────────────
  { path: '/admin/reports',                 id: 'reports',             label: 'Báo cáo',                  group: 'reports',  kind: 'workspace' },
  // ── system ──────────────────────────────────────────────
  { path: '/admin/settings',                id: 'settings',            label: 'Cài đặt',                  group: 'system',   kind: 'form' },
  { path: '/admin/admin-users',             id: 'admin-users',         label: 'Người dùng quản trị',      group: 'system',   kind: 'list' },
  { path: '/admin/roles',                   id: 'roles',               label: 'Vai trò & quyền',          group: 'system',   kind: 'list' },
  { path: '/admin/audit-logs',              id: 'audit-logs',          label: 'Nhật ký hệ thống',         group: 'system',   kind: 'list' },
]

/** Create/new form routes (no ID needed). */
export const CREATE_ROUTES: AdminRoute[] = [
  { path: '/admin/products/new',          id: 'product-create',  label: 'Tạo sản phẩm',   group: 'products', kind: 'form' },
  { path: '/admin/categories/new',        id: 'category-create', label: 'Tạo danh mục',   group: 'products', kind: 'form' },
  { path: '/admin/brands/new',            id: 'brand-create',    label: 'Tạo thương hiệu', group: 'products', kind: 'form' },
  { path: '/admin/content/article/new',   id: 'article-create',  label: 'Tạo bài viết',   group: 'content',  kind: 'form' },
]

export const ALL_SMOKE_ROUTES: AdminRoute[] = [...LIST_ROUTES, ...CREATE_ROUTES]

/** A representative subset used for the heavier responsive / effect sweeps. */
export const KEY_ROUTES: AdminRoute[] = [
  LIST_ROUTES.find((r) => r.id === 'dashboard')!,
  LIST_ROUTES.find((r) => r.id === 'orders')!,
  LIST_ROUTES.find((r) => r.id === 'products')!,
  LIST_ROUTES.find((r) => r.id === 'customers')!,
  CREATE_ROUTES.find((r) => r.id === 'category-create')!,
]
