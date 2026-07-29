// Query defaults, storefront base, and pure tree/breadcrumb helpers for
// CategoryListScreen. Extracted to keep the screen file focused on behaviour.
// Kept in a .js (no JSX) file so fast-refresh stays component-only elsewhere.

export const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/danh-muc`

// F11: khoá sessionStorage dùng để chuyển bản nháp "Nhân bản" sang màn tạo mới
// (CategoryDetailScreen đọc — cùng cơ chế DUPLICATE_SESSION_KEY của Sản phẩm).
export const DUPLICATE_SESSION_KEY = 'category-duplicate-payload'

export const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'sortOrder:asc',
  deleted: false,
  page: 1,
  pageSize: 20,
}

export const EMPTY_ITEMS = []

// Build map: id → full breadcrumb path (e.g. "Mũ Bảo Hiểm / Mũ Fullface")
export function buildBreadcrumbMap(items) {
  const byId = new Map(items.map((c) => [c.id, c]))
  const cache = new Map()
  // `seen` guards against a corrupt parent chain (e.g. A→B→A after a bad reorder or
  // stale cache): without it the recursion would loop forever and crash the list.
  // Each top-level walk gets its own `seen`; hitting an id already on the current
  // chain stops the walk at that node's own name instead of recursing again.
  const getPath = (id, seen) => {
    if (cache.has(id)) return cache.get(id)
    const cat = byId.get(id)
    if (!cat) return ''
    if (seen.has(id)) return cat.name || ''
    seen.add(id)
    const path = cat.parentId
      ? `${getPath(cat.parentId, seen)} / ${cat.name}`
      : cat.name
    cache.set(id, path)
    return path
  }
  const map = new Map()
  items.forEach((c) => map.set(c.id, getPath(c.id, new Set())))
  return map
}

// Build tree from flat list for tree-view rendering
export function buildTree(items) {
  const byId = new Map(items.map((c) => [c.id, { ...c, children: [] }]))
  const roots = []
  for (const c of byId.values()) {
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId).children.push(c)
    } else {
      roots.push(c)
    }
  }
  const sort = (arr) =>
    arr.sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder
      if (a.sortOrder != null) return -1
      if (b.sortOrder != null) return 1
      return a.name.localeCompare(b.name)
    })
  const flatten = (nodes, depth) => {
    const result = []
    sort(nodes).forEach((node) => {
      result.push({ ...node, _depth: depth })
      result.push(...flatten(node.children, depth + 1))
    })
    return result
  }
  return flatten(roots, 0)
}
