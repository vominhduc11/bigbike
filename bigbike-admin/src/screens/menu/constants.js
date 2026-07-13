// System slots, form defaults, context notes and pure helpers for MenuScreen.
// Extracted from MenuScreen.jsx so the screen file stays behaviour-focused and
// fast-refresh only sees components in the .jsx files.

import { normalizeMenu } from '../../lib/contracts'
import { buildCategoryTreeOrder } from '../product-detail/constants'

export { buildCategoryTreeOrder }

const CATEGORY_URL_PREFIX = '/danh-muc-san-pham/'

export function safeMenuDetailCache(data) {
  if (!data) return data
  if (data?.item) return { ...data, item: normalizeMenu(data.item) }
  return data
}

// ── System slots ───────────────────────────────────────────────────────────────
// Mirrors backend `MenuLocations.SYSTEM_LOCATIONS`. The storefront only renders
// menus at these locations, so the admin UI exposes them as fixed tabs and never
// allows creating/deleting menu containers.

export const SYSTEM_SLOTS = [
  {
    location: 'primary',
    titleKey: 'menus.slotPrimaryTitle',
    descKey: 'menus.slotPrimaryDesc',
    fallbackName: 'Header Menu',
  },
]

// ── Constants ──────────────────────────────────────────────────────────────────

export const EMPTY_ITEM = {
  label: '',
  labelEn: '',
  url: '',
  sortOrder: '0',
  parentId: '',
  openInNewTab: false,
  cssClass: '',
  status: 'ACTIVE',
  targetType: 'CUSTOM',
  targetId: '',
}

export function normalizeParentId(parentId) {
  return parentId || ''
}

export function sameParent(a, b) {
  return normalizeParentId(a) === normalizeParentId(b)
}

export function sortMenuItems(items) {
  return [...items].sort((a, b) => {
    const byOrder = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    if (byOrder !== 0) return byOrder
    return String(a.label || '').localeCompare(String(b.label || ''))
  })
}

export function buildMenuTree(items) {
  const byId = new Map()
  sortMenuItems(items).forEach((item) => {
    if (!item?.id || item.id === 'unknown') return
    byId.set(item.id, { ...item, children: [] })
  })
  const roots = []
  byId.forEach((node) => {
    const parentId = normalizeParentId(node.parentId)
    const parent = parentId ? byId.get(parentId) : null
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => {
      const byOrder = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
      if (byOrder !== 0) return byOrder
      return String(a.label || '').localeCompare(String(b.label || ''))
    })
    nodes.forEach((node) => sortChildren(node.children))
  }
  sortChildren(roots)
  return roots
}

export function flattenMenuTree(nodes, depth = 0) {
  return nodes
    .filter((node) => node != null && node.id)
    .flatMap((node) => [
      { ...node, depth },
      ...flattenMenuTree(node.children ?? [], depth + 1),
    ])
}

export function collectDescendantIds(items, itemId) {
  const childrenByParent = new Map()
  items.forEach((item) => {
    const parentId = normalizeParentId(item.parentId)
    if (!parentId) return
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
    childrenByParent.get(parentId).push(item.id)
  })
  const descendants = new Set()
  const visit = (id) => {
    for (const childId of childrenByParent.get(id) ?? []) {
      if (descendants.has(childId)) continue
      descendants.add(childId)
      visit(childId)
    }
  }
  visit(itemId)
  return descendants
}

export function formatParentOption(item) {
  return `${'── '.repeat(item.depth)}${item.label}`
}

export function formatCategoryOption(item) {
  return `${'── '.repeat(item.depth)}${item.name}`
}

// URL hiển thị mặc định (bản tiếng Việt) khi admin chọn danh mục từ picker.
// Bản tiếng Anh được backend tự resolve theo `slugEn` lúc đọc public — xem
// AdminMenuService.resolveDisplayUrl.
export function buildCategoryMenuUrl(category) {
  return `${CATEGORY_URL_PREFIX}${category.slug}`
}

export function isValidCustomUrl(url) {
  const v = url.trim()
  if (!v) return false
  if (v.startsWith('/') || v.startsWith('#') || v.startsWith('tel:') || v.startsWith('mailto:')) return true
  try { new URL(v); return true } catch { return false }
}

export function isItemFormValid(data) {
  if (!data.label.trim()) return false
  return data.url.trim() !== '' && isValidCustomUrl(data.url)
}

// Ghi chú ngữ cảnh cho từng slot — trả KEY i18n + defaultValue để screen resolve qua t()
// thay vì hardcode chuỗi (constants.js không có React context để gọi t() trực tiếp).
export const SLOT_CONTEXT_NOTE_KEYS = {
  primary: {
    key: 'menus.slotPrimaryContextNote',
    defaultValue: 'Mục này sẽ xuất hiện trên thanh điều hướng đầu trang website. Chỉ mục đang bật và có mục cha đang bật mới hiển thị.',
  },
}
