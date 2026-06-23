// Constants and pure helpers for AuditLogListScreen.
// Extracted from AuditLogListScreen.jsx to keep the screen file focused on behaviour.
// Kept in a .js (no JSX) file so fast-refresh stays component-only in the .jsx siblings.

import { formatDateTimeWithSeconds } from '../../lib/formatters'

// ── Actions that are dangerous — shown with a warning indicator ────────────────
export const DANGEROUS_ACTIONS = new Set([
  'ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_REFUND_CREATED',
  'PRODUCT_DELETED', 'PRODUCT_SOFT_DELETED',
  'CUSTOMER_DELETED',
  'CATEGORY_DELETED', 'CATEGORY_SOFT_DELETED',
  'BRAND_DELETED', 'BRAND_SOFT_DELETED',
  'MEDIA_DELETED', 'MEDIA_HARD_DELETED',
  'MENU_ITEM_DELETED', 'ROLE_DELETED', 'REDIRECT_DELETED',
  'CONTENT_ARTICLE_DELETED', 'CONTENT_PAGE_DELETED',
])

// Values considered dangerous in diff table (shown with danger highlight)
export const DANGEROUS_VALUES = new Set([
  'CANCELLED', 'REFUNDED', 'FAILED', 'BANNED', 'SUSPENDED',
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

// ── Diff helpers ───────────────────────────────────────────────────────────────
export function tryParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

// ── CSV export ─────────────────────────────────────────────────────────────────
export function buildCsvRow(log, t) {
  const actor = log.actorDisplayName || log.actorEmail || t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType || '' })
  const actorType = t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType || '' })
  const action = t(`auditLog.action.${log.action}`, { defaultValue: log.action || '' })
  const module = t(`auditLog.module.${log.resourceType}`, { defaultValue: log.resourceType || '' })
  const entity = log.resourceCode || log.resourceDisplayName || log.resourceId || ''
  return [formatDateTimeWithSeconds(log.createdAt), actor, actorType, action, module, entity]
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
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
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
  'REVIEW', 'REPORT',
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
