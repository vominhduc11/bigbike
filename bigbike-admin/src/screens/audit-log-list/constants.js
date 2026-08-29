// Constants and pure helpers for AuditLogListScreen.
// Extracted from AuditLogListScreen.jsx to keep the screen file focused on behaviour.
// Kept in a .js (no JSX) file so fast-refresh stays component-only in the .jsx siblings.

import { formatDateTimeWithSeconds } from '../../lib/formatters'

// ── Actions that are dangerous — shown with a warning indicator ────────────────
// Đối chiếu với mã hành động backend thật sự ghi (grep `auditLogFactory.build`)
// + mã còn tồn tại trong dữ liệu cũ. Trước đây tập này bỏ sót TOÀN BỘ nhóm
// `*_HARD_DELETED` (xoá vĩnh viễn — không khôi phục được) nên thao tác phá huỷ
// nhất lại hiển thị như dòng thường.
export const DANGEROUS_ACTIONS = new Set([
  // Xoá vĩnh viễn — không thể khôi phục
  'PRODUCT_HARD_DELETED', 'CATEGORY_HARD_DELETED', 'BRAND_HARD_DELETED',
  'CONTENT_ARTICLE_HARD_DELETED', 'MEDIA_HARD_DELETED',
  // Chuyển vào Thùng rác / xoá mềm
  'PRODUCT_SOFT_DELETED', 'CATEGORY_SOFT_DELETED', 'BRAND_SOFT_DELETED',
  'CONTENT_ARTICLE_DELETED', 'MEDIA_DELETED',
  // Xoá bản ghi cấu hình / nội dung
  'MENU_DELETED', 'MENU_ITEM_DELETED', 'ROLE_DELETED', 'REDIRECT_DELETED',
  'SLIDER_DELETED', 'HOME_VIDEO_DELETED', 'MEDIA_FOLDER_DELETED',
  'ATTRIBUTE_DELETED', 'ATTRIBUTE_VALUE_DELETED', 'REVIEW_DELETED',
  'CUSTOMER_AVATAR_REMOVED',
  // Khoá quyền truy cập của người dùng quản trị
  'ADMIN_USER_DISABLED', 'ADMIN_USER_SUSPENDED',
  // Sự cố đăng nhập
  'ADMIN_LOGIN_FAILED', 'ADMIN_ACCOUNT_LOCKED',
  // Mã cũ — giữ lại để bản ghi lịch sử vẫn được đánh dấu đúng
  'ORDER_CANCELLED', 'PRODUCT_DELETED', 'CUSTOMER_DELETED',
  'CATEGORY_DELETED', 'BRAND_DELETED',
])

// Values considered dangerous in diff table (shown with danger highlight)
export const DANGEROUS_VALUES = new Set([
  'CANCELLED', 'FAILED', 'BANNED', 'SUSPENDED',
])

// ── Date preset helper ─────────────────────────────────────────────────────────
export function getDatePreset(preset) {
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const todayStr = fmt(today)

  if (preset === 'today') return { from: todayStr, to: todayStr }
  if (preset === '7d') {
    const from = new Date(today); from.setDate(from.getDate() - 6)
    return { from: fmt(from), to: todayStr }
  }
  if (preset === '30d') {
    const from = new Date(today); from.setDate(from.getDate() - 29)
    return { from: fmt(from), to: todayStr }
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: fmt(from), to: todayStr }
  }
  return { from: '', to: '' }
}

export function toBadgeVariant(tone) {
  return tone === 'neutral' ? 'muted' : tone
}

// ── Nguồn CHUNG cho tone của từng module — trước đây AuditCard và cells.jsx tự khai
// báo map riêng (lệch nhau, thiếu key). Gom về đây để 2 nơi import cùng 1 nguồn. ──
export const MODULE_TONE_MAP = {
  ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
  INVENTORY: 'warning', CUSTOMER: 'neutral', SITE_SETTING: 'danger',
  MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral',
  ADMIN_ROLE: 'danger', ADMIN_USER: 'neutral', REDIRECT: 'warning',
}

export function getModuleTone(resourceType) {
  return MODULE_TONE_MAP[resourceType] || 'neutral'
}

// Nhãn module/hành động dùng chung (fallback thống nhất giữa bảng và thẻ mobile).
export function getModuleLabel(t, resourceType) {
  return t(`auditLog.module.${resourceType}`, { defaultValue: t('auditLog.module.OTHER') })
}

export function getActionLabel(t, action) {
  if (!action) return '—'
  const key = `auditLog.action.${action}`
  const translated = t(key, { defaultValue: '' })
  if (translated && translated !== key) return translated
  const fallback = t('auditLog.actionOther', { code: action, defaultValue: t('common.unknown') })
  return fallback && !/^\(.+\)$/.test(fallback) ? fallback : t('common.unknown')
}

export function getAuditCardData(log, t) {
  const actionLabel = getActionLabel(t, log.action)
  return {
    actionLabel,
    isDangerous: DANGEROUS_ACTIONS.has(log.action),
    timeLabel: formatDateTimeWithSeconds(log.createdAt),
    actorLabel: log.actorDisplayName
      || log.actorEmail
      || t(`auditLog.actorType.${log.actorType}`, {
        defaultValue: t('auditLog.actorType.ADMIN'),
      }),
    resourceLabel: log.resourceCode
      || log.resourceDisplayName
      || (log.resourceId ? log.resourceId.slice(0, 8) : '—'),
    selectionLabel: t('auditLog.openDetailAria', {
      action: actionLabel,
      defaultValue: `Mở chi tiết: ${actionLabel}`,
    }),
  }
}

// ── Diff helpers ───────────────────────────────────────────────────────────────
export function tryParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

// ── CSV export ─────────────────────────────────────────────────────────────────
export function buildCsvRow(log, t) {
  const actor = log.actorDisplayName || log.actorEmail || t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('common.unknown') })
  const actorType = t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('common.unknown') })
  const action = t(`auditLog.action.${log.action}`, { defaultValue: t('common.unknown') })
  const module = t(`auditLog.module.${log.resourceType}`, { defaultValue: t('auditLog.module.OTHER') })
  const entity = log.resourceCode || log.resourceDisplayName || log.resourceId || ''
  return [formatDateTimeWithSeconds(log.createdAt), actor, actorType, action, module, entity]
}

export function sanitizeSpreadsheetCell(value) {
  const text = String(value ?? '')
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
}

export function exportToCsv(items, t) {
  const headers = [
    t('auditLog.colTime'),
    t('auditLog.colActor'),
    t('auditLog.filterActorType'),
    t('auditLog.colAction'),
    t('auditLog.colModule'),
    t('auditLog.colEntity'),
  ]
  const rows = items.map((log) => buildCsvRow(log, t))
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${sanitizeSpreadsheetCell(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const bom = '﻿'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Filter constants ───────────────────────────────────────────────────────────
export const ACTOR_OPTIONS    = ['ALL', 'ADMIN', 'CUSTOMER', 'SYSTEM']
export const RESOURCE_OPTIONS = [
  'ALL',
  'ORDER', 'PRODUCT', 'CATEGORY', 'BRAND', 'INVENTORY',
  'CUSTOMER', 'CONTENT', 'MEDIA', 'MENU', 'MENU_ITEM',
  'SITE_SETTING', 'ADMIN_ROLE', 'ADMIN_USER', 'REDIRECT',
  'REVIEW', 'REPORT', 'ADMIN_AUTH', 'SLIDER', 'HOME_VIDEO',
  'MEDIA_FOLDER', 'ATTRIBUTE', 'HOME_HIGHLIGHT',
]
export const PRESET_KEYS      = ['today', '7d', '30d', 'month']

export const INITIAL_QUERY = {
  actorType: 'ALL', resourceType: 'ALL',
  q: '', from: '', to: '', page: 1, pageSize: 20,
}

export function setDetailParam(id) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('detail', id)
  else url.searchParams.delete('detail')
  window.history.replaceState(null, '', url.toString())
}
