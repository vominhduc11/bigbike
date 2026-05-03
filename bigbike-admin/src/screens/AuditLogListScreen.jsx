import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAuditLogs } from '../lib/adminApi'
import { formatDateTimeWithSeconds } from '../lib/formatters'

// ── Action label mapping ───────────────────────────────────────────────────────
const ACTION_LABELS = {
  ORDER_CREATED:                'Tạo đơn hàng',
  ORDER_UPDATED:                'Cập nhật đơn hàng',
  ORDER_CANCELLED:              'Huỷ đơn hàng',
  ORDER_COMPLETED:              'Hoàn tất đơn hàng',
  ORDER_REFUNDED:               'Hoàn tiền đơn hàng',
  ORDER_REFUND_CREATED:         'Tạo yêu cầu hoàn tiền',
  ORDER_STATUS_UPDATED:         'Cập nhật trạng thái đơn',
  ORDER_STATUS_CHANGED:         'Thay đổi trạng thái đơn',
  ORDER_PAYMENT_STATUS_UPDATED: 'Cập nhật thanh toán đơn',
  ORDER_PAYMENT_STATUS_CHANGED: 'Thay đổi thanh toán đơn',
  ORDER_NOTE_CREATED:           'Thêm ghi chú đơn hàng',
  ORDER_NOTE_ADDED:             'Thêm ghi chú đơn hàng',
  PRODUCT_CREATED:              'Tạo sản phẩm',
  PRODUCT_UPDATED:              'Cập nhật sản phẩm',
  PRODUCT_DELETED:              'Xoá sản phẩm',
  STOCK_ADJUSTED:               'Điều chỉnh tồn kho',
  INVENTORY_UPDATED:            'Cập nhật tồn kho',
  STOCK_IN:                     'Nhập kho',
  STOCK_OUT:                    'Xuất kho',
  SERIAL_ASSIGNED:              'Gán số serial',
  SERIAL_RETURNED:              'Thu hồi serial',
  COUPON_CREATED:               'Tạo mã giảm giá',
  COUPON_UPDATED:               'Cập nhật mã giảm giá',
  COUPON_DELETED:               'Xoá mã giảm giá',
  COUPON_STATUS_UPDATED:        'Cập nhật trạng thái coupon',
  CUSTOMER_CREATED:             'Tạo khách hàng',
  CUSTOMER_UPDATED:             'Cập nhật khách hàng',
  CUSTOMER_DELETED:             'Xoá khách hàng',
  CUSTOMER_STATUS_UPDATED:      'Cập nhật trạng thái khách hàng',
  CATEGORY_CREATED:             'Tạo danh mục',
  CATEGORY_UPDATED:             'Cập nhật danh mục',
  CATEGORY_DELETED:             'Xoá danh mục',
  BRAND_CREATED:                'Tạo thương hiệu',
  BRAND_UPDATED:                'Cập nhật thương hiệu',
  BRAND_DELETED:                'Xoá thương hiệu',
  MEDIA_UPLOADED:               'Tải lên tệp media',
  MEDIA_DELETED:                'Xoá tệp media',
  MEDIA_UPDATED:                'Cập nhật tệp media',
  MEDIA_HARD_DELETED:           'Xoá vĩnh viễn tệp media',
  MEDIA_RESTORED:               'Khôi phục tệp media',
  MENU_UPDATED:                 'Cập nhật menu',
  MENU_ITEM_CREATED:            'Thêm mục menu',
  MENU_ITEM_UPDATED:            'Cập nhật mục menu',
  MENU_ITEM_DELETED:            'Xoá mục menu',
  MENU_ITEMS_REORDERED:         'Sắp xếp lại menu',
  CONTENT_UPDATED:              'Cập nhật nội dung',
  SETTINGS_UPDATED:             'Cập nhật cài đặt',
  SETTING_UPDATED:              'Cập nhật cài đặt',
  ADMIN_USER_CREATED:           'Tạo tài khoản quản trị',
  ADMIN_USER_UPDATED:           'Cập nhật quản trị viên',
  ROLE_CREATED:                 'Tạo vai trò',
  ROLE_DELETED:                 'Xoá vai trò',
  ROLE_PERMISSIONS_UPDATED:     'Cập nhật quyền vai trò',
}

// Actions that are dangerous — shown with a warning indicator
const DANGEROUS_ACTIONS = new Set([
  'ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_REFUND_CREATED',
  'PRODUCT_DELETED', 'COUPON_DELETED', 'CUSTOMER_DELETED',
  'CATEGORY_DELETED', 'BRAND_DELETED', 'MEDIA_DELETED', 'MEDIA_HARD_DELETED',
  'MENU_ITEM_DELETED', 'ROLE_DELETED',
])

function getActionLabel(action) {
  if (!action) return 'Hoạt động khác'
  return ACTION_LABELS[action] ?? null
}

// ── Module config ──────────────────────────────────────────────────────────────
const MODULE_CONFIG = {
  ORDER:      { label: 'Đơn hàng',       tone: 'info' },
  PRODUCT:    { label: 'Sản phẩm',       tone: 'success' },
  CATEGORY:   { label: 'Danh mục',       tone: 'neutral' },
  BRAND:      { label: 'Thương hiệu',    tone: 'neutral' },
  INVENTORY:  { label: 'Kho hàng',       tone: 'warning' },
  COUPON:     { label: 'Giảm giá',       tone: 'warning' },
  CUSTOMER:   { label: 'Khách hàng',     tone: 'neutral' },
  SETTING:    { label: 'Cài đặt',        tone: 'danger' },
  MEDIA:      { label: 'Tệp / Media',    tone: 'neutral' },
  MENU:       { label: 'Menu',           tone: 'neutral' },
  CONTENT:    { label: 'Nội dung',       tone: 'neutral' },
  ROLE:       { label: 'Phân quyền',     tone: 'danger' },
  ADMIN_USER: { label: 'Quản trị viên',  tone: 'neutral' },
}

function getModuleConfig(resourceType) {
  return MODULE_CONFIG[resourceType] || { label: resourceType || 'Khác', tone: 'neutral' }
}

// ── Actor type labels ──────────────────────────────────────────────────────────
const ACTOR_TYPE_LABELS = {
  ADMIN:    'Quản trị viên',
  CUSTOMER: 'Khách hàng',
  SYSTEM:   'Hệ thống',
}

function getActorFallbackLabel(actorType) {
  if (actorType === 'SYSTEM') return 'Hệ thống'
  if (actorType === 'CUSTOMER') return 'Khách hàng'
  return 'Quản trị viên'
}

// ── Field & value labels ───────────────────────────────────────────────────────
const FIELD_LABELS = {
  status:          'Trạng thái',
  orderStatus:     'Trạng thái đơn',
  paymentStatus:   'Thanh toán',
  quantityOnHand:  'Tồn kho',
  price:           'Giá bán',
  compareAtPrice:  'Giá gốc',
  name:            'Tên',
  email:           'Email',
  phone:           'Số điện thoại',
  enabled:         'Kích hoạt',
  active:          'Hoạt động',
  isActive:        'Hoạt động',
  discountValue:   'Giá trị giảm',
  discountType:    'Loại giảm',
  code:            'Mã',
  description:     'Mô tả',
  slug:            'Đường dẫn',
  stockQuantity:   'Số lượng kho',
  usageLimit:      'Giới hạn sử dụng',
  minOrderValue:   'Đơn tối thiểu',
  publishStatus:   'Trạng thái xuất bản',
  displayName:     'Tên hiển thị',
  role:            'Vai trò',
  permissions:     'Quyền',
}

const VALUE_LABELS = {
  PENDING:          'Chờ xử lý',
  ON_HOLD:          'Tạm giữ',
  PROCESSING:       'Đang xử lý',
  COMPLETED:        'Hoàn tất',
  CANCELLED:        'Đã huỷ',
  FAILED:           'Thất bại',
  REFUNDED:         'Đã hoàn',
  UNPAID:           'Chưa thanh toán',
  PAID:             'Đã thanh toán',
  PARTIALLY_PAID:   'Thanh toán một phần',
  OVERPAID:         'Thanh toán dư',
  ACTIVE:           'Đang hoạt động',
  SUSPENDED:        'Tạm khoá',
  BANNED:           'Bị cấm',
  DRAFT:            'Nháp',
  PUBLISHED:        'Đã xuất bản',
  HIDDEN:           'Ẩn',
  ARCHIVED:         'Lưu trữ',
  true:             'Có',
  false:            'Không',
}

function mapValue(val) {
  if (val === null || val === undefined) return '—'
  const str = String(val)
  return VALUE_LABELS[str] || str
}

function tryParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

function computeDiff(beforeData, afterData) {
  const before = beforeData ? tryParse(beforeData) : null
  const after  = afterData  ? tryParse(afterData)  : null
  if (
    !before || !after ||
    typeof before !== 'object' || typeof after !== 'object' ||
    Array.isArray(before) || Array.isArray(after)
  ) return null
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changes = []
  for (const key of allKeys) {
    if (String(before[key]) !== String(after[key])) {
      changes.push({
        key,
        label: FIELD_LABELS[key] || key,
        before: mapValue(before[key]),
        after:  mapValue(after[key]),
      })
    }
  }
  return changes
}

// ── Date presets ───────────────────────────────────────────────────────────────
function getDatePreset(preset) {
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const todayStr = fmt(today)

  if (preset === 'today') return { from: todayStr, to: todayStr }

  if (preset === '7d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { from: fmt(from), to: todayStr }
  }

  if (preset === '30d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return { from: fmt(from), to: todayStr }
  }

  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: fmt(from), to: todayStr }
  }

  return { from: '', to: '' }
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportToCsv(items) {
  const headers = ['Thời gian', 'Người thực hiện', 'Loại', 'Việc đã làm', 'Mục quản lý', 'Liên quan đến']
  const rows = items.map((log) => {
    const actor = log.actorDisplayName || log.actorEmail || getActorFallbackLabel(log.actorType)
    const actorType = ACTOR_TYPE_LABELS[log.actorType] || log.actorType || ''
    const action = getActionLabel(log.action) ?? 'Hoạt động khác'
    const module = getModuleConfig(log.resourceType).label
    const entity = log.resourceCode || log.resourceDisplayName || log.resourceId || ''
    return [formatDateTimeWithSeconds(log.createdAt), actor, actorType, action, module, entity]
  })

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const bom = '﻿'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Filter constants ───────────────────────────────────────────────────────────
const ACTOR_OPTIONS    = ['ALL', 'ADMIN', 'CUSTOMER', 'SYSTEM']
const RESOURCE_OPTIONS = ['ALL', 'ORDER', 'PRODUCT', 'CATEGORY', 'BRAND', 'INVENTORY', 'COUPON', 'CUSTOMER', 'SETTING', 'MEDIA', 'MENU', 'CONTENT', 'ROLE', 'ADMIN_USER']

// Action options grouped by module for the action filter dropdown
const ACTION_OPTIONS = [
  { value: 'ALL', label: 'Tất cả hành động' },
  { value: 'ORDER_CREATED',                label: 'Tạo đơn hàng' },
  { value: 'ORDER_CANCELLED',              label: 'Huỷ đơn hàng' },
  { value: 'ORDER_COMPLETED',              label: 'Hoàn tất đơn hàng' },
  { value: 'ORDER_REFUNDED',               label: 'Hoàn tiền đơn hàng' },
  { value: 'ORDER_STATUS_CHANGED',         label: 'Thay đổi trạng thái đơn' },
  { value: 'ORDER_PAYMENT_STATUS_CHANGED', label: 'Thay đổi thanh toán đơn' },
  { value: 'PRODUCT_CREATED',              label: 'Tạo sản phẩm' },
  { value: 'PRODUCT_UPDATED',              label: 'Cập nhật sản phẩm' },
  { value: 'PRODUCT_DELETED',              label: 'Xoá sản phẩm' },
  { value: 'STOCK_ADJUSTED',               label: 'Điều chỉnh tồn kho' },
  { value: 'STOCK_IN',                     label: 'Nhập kho' },
  { value: 'STOCK_OUT',                    label: 'Xuất kho' },
  { value: 'SERIAL_ASSIGNED',              label: 'Gán số serial' },
  { value: 'COUPON_CREATED',               label: 'Tạo mã giảm giá' },
  { value: 'COUPON_DELETED',               label: 'Xoá mã giảm giá' },
  { value: 'CUSTOMER_CREATED',             label: 'Tạo khách hàng' },
  { value: 'CUSTOMER_DELETED',             label: 'Xoá khách hàng' },
  { value: 'ADMIN_USER_CREATED',           label: 'Tạo tài khoản quản trị' },
  { value: 'ROLE_CREATED',                 label: 'Tạo vai trò' },
  { value: 'ROLE_DELETED',                 label: 'Xoá vai trò' },
  { value: 'ROLE_PERMISSIONS_UPDATED',     label: 'Cập nhật quyền vai trò' },
  { value: 'SETTINGS_UPDATED',             label: 'Cập nhật cài đặt' },
]

const DATE_PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d',    label: '7 ngày qua' },
  { value: '30d',   label: '30 ngày qua' },
  { value: 'month', label: 'Tháng này' },
]

function readQueryFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search)
    return {
      actorType:    p.get('actorType')    || 'ALL',
      resourceType: p.get('resourceType') || 'ALL',
      action:       p.get('action')       || 'ALL',
      q:            p.get('q')            || '',
      from:         p.get('from')         || '',
      to:           p.get('to')           || '',
      page:         Number(p.get('page')) || 1,
      pageSize:     Number(p.get('pageSize')) || 20,
    }
  } catch {
    return null
  }
}

const INITIAL_QUERY = {
  actorType: 'ALL', resourceType: 'ALL', action: 'ALL',
  q: '', from: '', to: '', page: 1, pageSize: 20,
}

function buildInitialQuery() {
  return readQueryFromUrl() || INITIAL_QUERY
}

function pushQueryToUrl(query) {
  try {
    const p = new URLSearchParams()
    if (query.actorType    !== 'ALL') p.set('actorType',    query.actorType)
    if (query.resourceType !== 'ALL') p.set('resourceType', query.resourceType)
    if (query.action       !== 'ALL') p.set('action',       query.action)
    if (query.q)     p.set('q',    query.q)
    if (query.from)  p.set('from', query.from)
    if (query.to)    p.set('to',   query.to)
    if (query.page   !== 1)  p.set('page',     String(query.page))
    if (query.pageSize !== 20) p.set('pageSize', String(query.pageSize))
    const qs = p.toString()
    const newUrl = window.location.pathname + (qs ? '?' + qs : '')
    window.history.replaceState(null, '', newUrl)
  } catch { /* ignore */ }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModuleBadge({ resourceType }) {
  const { label, tone } = getModuleConfig(resourceType)
  return <span className={`status-badge status-${tone}`}>{label}</span>
}

function ActorCell({ log }) {
  const displayName = log.actorDisplayName || log.actorEmail || null
  const fallback = getActorFallbackLabel(log.actorType)
  const actorTypeSuffix = log.actorType && log.actorType !== 'ADMIN'
    ? ` (${ACTOR_TYPE_LABELS[log.actorType] || log.actorType})`
    : ''

  return (
    <div className="audit-actor-cell">
      {displayName
        ? <span className="audit-actor-name">{displayName}{actorTypeSuffix && <span className="audit-actor-type">{actorTypeSuffix}</span>}</span>
        : <span className="audit-actor-unknown">{fallback}</span>
      }
    </div>
  )
}

function ResourceCell({ log }) {
  const label = log.resourceCode || log.resourceDisplayName || null
  if (label) return <span className="audit-resource-label">{label}</span>
  if (log.resourceId) {
    return <span className="audit-resource-label audit-resource-id" title={log.resourceId}>ID #{log.resourceId.slice(0, 8)}</span>
  }
  return <span style={{ color: 'var(--admin-color-text-muted)' }}>—</span>
}

function ActionLabel({ action }) {
  const label = getActionLabel(action)
  const isDangerous = DANGEROUS_ACTIONS.has(action)
  return (
    <span className={`audit-action-label${isDangerous ? ' audit-action-danger' : ''}`}>
      {isDangerous && <span className="audit-danger-icon" aria-label="Thao tác quan trọng">⚠</span>}
      {label ?? 'Hoạt động khác'}
    </span>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="audit-detail-row">
      <span className="audit-detail-label">{label}</span>
      <span className="audit-detail-value">{children}</span>
    </div>
  )
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

function AuditDetailDrawer({ log, onClose }) {
  const { t } = useTranslation()
  const closeRef  = useRef(null)
  const diff      = useMemo(() => computeDiff(log.beforeData, log.afterData), [log.beforeData, log.afterData])
  const [showRaw, setShowRaw] = useState(false)
  const { label: moduleLabel, tone: moduleTone } = getModuleConfig(log.resourceType)
  const actionLabel = getActionLabel(log.action)
  const displayName = log.actorDisplayName || log.actorEmail || null
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)

  useEffect(() => { closeRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const hasRaw = !!(log.beforeData || log.afterData)

  return (
    <div
      className="audit-drawer-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-hidden="false"
    >
      <aside
        className="audit-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-drawer-title"
      >
        <div className="audit-drawer-header">
          <h2 id="audit-drawer-title" className="audit-drawer-title">
            Chi tiết thao tác
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Đóng"
            style={{ padding: '0.2rem 0.55rem', fontSize: '1rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div className="audit-drawer-body">
          {isDangerous && (
            <div className="audit-danger-banner">
              ⚠ Đây là thao tác quan trọng — cần lưu ý khi xem xét.
            </div>
          )}

          <div className="audit-detail-section">
            <DetailRow label="Thời gian">
              <time title={log.createdAt}>{formatDateTimeWithSeconds(log.createdAt)}</time>
            </DetailRow>

            <DetailRow label="Người thực hiện">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {displayName
                  ? <strong style={{ fontSize: '0.875rem' }}>{displayName}</strong>
                  : <span style={{ fontSize: '0.875rem', color: 'var(--admin-color-text-muted)', fontStyle: 'italic' }}>
                      {getActorFallbackLabel(log.actorType)}
                    </span>
                }
                {log.actorType && log.actorType !== 'ADMIN' && (
                  <span className="status-badge status-neutral" style={{ fontSize: '0.72rem' }}>
                    {ACTOR_TYPE_LABELS[log.actorType] || log.actorType}
                  </span>
                )}
              </div>
            </DetailRow>

            <DetailRow label="Việc đã làm">
              <strong>{actionLabel ?? 'Hoạt động khác'}</strong>
            </DetailRow>

            <DetailRow label="Mục quản lý">
              <span className={`status-badge status-${moduleTone}`}>{moduleLabel}</span>
            </DetailRow>

            {(log.resourceCode || log.resourceDisplayName || log.resourceId) && (
              <DetailRow label="Liên quan đến">
                <strong style={{ fontSize: '0.875rem' }}>
                  {log.resourceCode || log.resourceDisplayName || `#${log.resourceId?.slice(0, 8)}`}
                </strong>
              </DetailRow>
            )}
          </div>

          <div className="audit-drawer-section">
            <h3 className="audit-drawer-section-title">Chi tiết thay đổi</h3>
            {(!diff || diff.length === 0) && (
              <p className="audit-no-changes">Chưa có thông tin thay đổi để hiển thị.</p>
            )}
            {diff && diff.length > 0 && (
              <table className="audit-diff-table">
                <thead>
                  <tr>
                    <th>Trường</th>
                    <th>Trước</th>
                    <th>Sau</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((row) => (
                    <tr key={row.key}>
                      <td className="audit-diff-field">{row.label}</td>
                      <td className="audit-diff-before">{row.before}</td>
                      <td className="audit-diff-after">{row.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {hasRaw && (
            <div className="audit-drawer-section">
              <button
                type="button"
                className="audit-tech-toggle"
                onClick={() => setShowRaw((p) => !p)}
                aria-expanded={showRaw}
              >
                Xem chi tiết kỹ thuật
                <span aria-hidden="true" style={{ marginLeft: 4 }}>{showRaw ? '▲' : '▼'}</span>
              </button>
              {showRaw && (
                <div className="audit-tech-body">
                  {log.beforeData && (
                    <>
                      <p className="audit-tech-label">Trước</p>
                      <pre className="audit-tech-pre">
                        {JSON.stringify(tryParse(log.beforeData) ?? log.beforeData, null, 2)}
                      </pre>
                    </>
                  )}
                  {log.afterData && (
                    <>
                      <p className="audit-tech-label" style={{ marginTop: '0.75rem' }}>Sau</p>
                      <pre className="audit-tech-pre">
                        {JSON.stringify(tryParse(log.afterData) ?? log.afterData, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ── Mobile audit card ──────────────────────────────────────────────────────────

function AuditCard({ log, onClick }) {
  const { label: moduleLabel, tone: moduleTone } = getModuleConfig(log.resourceType)
  const actionLabel = getActionLabel(log.action) ?? 'Hoạt động khác'
  const actorName = log.actorDisplayName || log.actorEmail || getActorFallbackLabel(log.actorType)
  const resourceLabel = log.resourceCode || log.resourceDisplayName || null
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }

  return (
    <div
      className={`audit-card${isDangerous ? ' audit-card--danger' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-label={`${actionLabel}, ${formatDateTimeWithSeconds(log.createdAt)}`}
    >
      <div className="audit-card-top">
        <span className="audit-card-action">
          {isDangerous && <span className="audit-danger-icon" aria-hidden="true">⚠ </span>}
          {actionLabel}
        </span>
        <time className="audit-card-time" title={log.createdAt}>
          {formatDateTimeWithSeconds(log.createdAt)}
        </time>
      </div>
      <div className="audit-card-meta">
        <span className={`status-badge status-${moduleTone}`} style={{ fontSize: '0.72rem' }}>
          {moduleLabel}
        </span>
        <span>{actorName}</span>
        {resourceLabel && (
          <span className="audit-resource-label" style={{ fontSize: '0.75rem' }}>{resourceLabel}</span>
        )}
      </div>
      <div className="audit-card-chevron" aria-hidden="true">›</div>
    </div>
  )
}

// ── Mobile Filter Drawer ───────────────────────────────────────────────────────

function MobileFilterDrawer({ query, searchInput, onSearch, setSearchInput, onUpdate, onReset, onClose, isFiltered }) {
  const [localFrom, setLocalFrom] = useState(query.from)
  const [localTo, setLocalTo]     = useState(query.to)

  function applyDates() {
    onUpdate({ from: localFrom, to: localTo }, { resetPage: true })
    onClose()
  }

  function applyPreset(preset) {
    const { from, to } = getDatePreset(preset)
    setLocalFrom(from)
    setLocalTo(to)
    onUpdate({ from, to }, { resetPage: true })
    onClose()
  }

  return (
    <div className="audit-mobile-filter-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="audit-mobile-filter-sheet">
        <div className="audit-mobile-filter-header">
          <strong>Bộ lọc</strong>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.2rem 0.55rem' }}>✕</button>
        </div>
        <div className="audit-mobile-filter-body">
          <label>
            <span>Tìm kiếm</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                className="control-input"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onSearch(); onClose() } }}
                placeholder="Tìm mã đơn, sản phẩm, khách hàng..."
              />
              <button type="button" className="btn btn-secondary" onClick={() => { onSearch(); onClose() }}>Tìm</button>
            </div>
          </label>

          <label>
            <span>Mục quản lý</span>
            <select className="control-select" value={query.resourceType}
              onChange={(e) => onUpdate({ resourceType: e.target.value }, { resetPage: true })}>
              <option value="ALL">Tất cả</option>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <option key={r} value={r}>{getModuleConfig(r).label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Hành động</span>
            <select className="control-select" value={query.action}
              onChange={(e) => onUpdate({ action: e.target.value }, { resetPage: true })}>
              {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label>
            <span>Người thực hiện</span>
            <select className="control-select" value={query.actorType}
              onChange={(e) => onUpdate({ actorType: e.target.value }, { resetPage: true })}>
              <option value="ALL">Tất cả</option>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <option key={a} value={a}>{ACTOR_TYPE_LABELS[a] || a}</option>
              ))}
            </select>
          </label>

          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>Thời gian nhanh</span>
            <div className="audit-preset-chips">
              {DATE_PRESETS.map((p) => (
                <button key={p.value} type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1 }}>
              <span>Từ ngày</span>
              <input className="control-input" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              <span>Đến ngày</span>
              <input className="control-input" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={applyDates}>
            Áp dụng ngày
          </button>

          {isFiltered && (
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { onReset(); onClose() }}>
              Xoá tất cả bộ lọc
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function AuditLogListScreen() {
  const [query, setQuery]             = useState(buildInitialQuery)
  const [searchInput, setSearchInput] = useState(() => buildInitialQuery().q)
  const [state, setState]             = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [selectedLog, setSelectedLog] = useState(null)
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  const [activePreset, setActivePreset] = useState(null)
  const refreshCountRef = useRef(0)

  const isFiltered = query.actorType !== 'ALL' || query.resourceType !== 'ALL' || query.action !== 'ALL' || !!query.q || !!query.from || !!query.to
  const activeFilterCount = [
    query.actorType    !== 'ALL',
    query.resourceType !== 'ALL',
    query.action       !== 'ALL',
    !!query.q,
    !!query.from || !!query.to,
  ].filter(Boolean).length

  useEffect(() => {
    pushQueryToUrl(query)
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchAuditLogs(query)
      .then((r) => {
        if (!active) return
        setState({
          status: 'success',
          items: r.items,
          pagination: r.pagination,
          warning: r.mode === 'mock' ? r.warning : '',
        })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query, refreshCountRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    {
      key: 'createdAt',
      label: 'Thời gian',
      render: (r) => (
        <time className="audit-col-time" title={r.createdAt}>
          {formatDateTimeWithSeconds(r.createdAt)}
        </time>
      ),
    },
    {
      key: 'actor',
      label: 'Người thực hiện',
      render: (r) => <ActorCell log={r} />,
    },
    {
      key: 'action',
      label: 'Việc đã làm',
      render: (r) => <ActionLabel action={r.action} />,
    },
    {
      key: 'module',
      label: 'Mục quản lý',
      render: (r) => <ModuleBadge resourceType={r.resourceType} />,
    },
    {
      key: 'entity',
      label: 'Liên quan đến',
      render: (r) => <ResourceCell log={r} />,
    },
  ], [])

  const updateQuery = useCallback((partial, options = { resetPage: false }) => {
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }, [])

  function handleSearch() {
    updateQuery({ q: searchInput }, { resetPage: true })
  }

  function handleReset() {
    setSearchInput('')
    setActivePreset(null)
    setQuery(INITIAL_QUERY)
  }

  function handlePreset(preset) {
    setActivePreset(preset)
    const { from, to } = getDatePreset(preset)
    updateQuery({ from, to }, { resetPage: true })
  }

  function handleRefresh() {
    refreshCountRef.current += 1
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => ({ ...p }))
  }

  function handleRowClick(log) {
    setSelectedLog(log)
  }

  function handleExport() {
    if (state.items.length === 0) return
    exportToCsv(state.items)
  }

  const totalItems = state.pagination?.totalItems

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Hệ thống</p>
          <h1>Nhật ký hoạt động</h1>
          <p style={{ color: 'var(--admin-color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Theo dõi các thao tác quan trọng trong admin: đơn hàng, sản phẩm, kho, cài đặt và người dùng.
          </p>
        </div>
        <div className="audit-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            title="Tải lại danh sách"
          >
            ↻ Làm mới
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={state.items.length === 0}
            title="Xuất danh sách hiện tại ra file CSV (mở được bằng Excel)"
          >
            ↓ Xuất Excel
          </button>
        </div>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {/* ── Desktop filter bar ── */}
      <section className="filter-bar audit-filter-bar">
        <label>
          <span>Tìm kiếm</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              className="control-input"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Tìm mã đơn, sản phẩm, khách hàng, người thao tác…"
              style={{ minWidth: 220 }}
            />
            <button type="button" className="btn btn-secondary" onClick={handleSearch}>Tìm</button>
          </div>
        </label>

        <label>
          <span>Mục quản lý</span>
          <select
            className="control-select"
            value={query.resourceType}
            onChange={(e) => updateQuery({ resourceType: e.target.value }, { resetPage: true })}
          >
            <option value="ALL">Tất cả</option>
            {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
              <option key={r} value={r}>{getModuleConfig(r).label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Hành động</span>
          <select
            className="control-select"
            value={query.action}
            onChange={(e) => updateQuery({ action: e.target.value }, { resetPage: true })}
          >
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label>
          <span>Người thực hiện</span>
          <select
            className="control-select"
            value={query.actorType}
            onChange={(e) => updateQuery({ actorType: e.target.value }, { resetPage: true })}
          >
            <option value="ALL">Tất cả</option>
            {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
              <option key={a} value={a}>{ACTOR_TYPE_LABELS[a] || a}</option>
            ))}
          </select>
        </label>

        <div>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>Thời gian nhanh</span>
          <div className="audit-preset-chips">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`btn btn-secondary btn-sm${activePreset === p.value ? ' audit-preset-active' : ''}`}
                onClick={() => handlePreset(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <label>
            <span>Từ ngày</span>
            <input
              className="control-input"
              type="date"
              value={query.from}
              onChange={(e) => { setActivePreset(null); updateQuery({ from: e.target.value }, { resetPage: true }) }}
            />
          </label>
          <label>
            <span>Đến ngày</span>
            <input
              className="control-input"
              type="date"
              value={query.to}
              onChange={(e) => { setActivePreset(null); updateQuery({ to: e.target.value }, { resetPage: true }) }}
            />
          </label>
          {isFiltered && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ alignSelf: 'flex-end' }}
            >
              Xoá lọc
            </button>
          )}
        </div>
      </section>

      {/* ── Mobile filter toggle ── */}
      <div className="audit-mobile-filter-toggle">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowMobileFilter(true)}
        >
          Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        {query.q && (
          <span className="audit-mobile-search-chip">
            "{query.q}"
            <button type="button" onClick={() => { setSearchInput(''); updateQuery({ q: '' }, { resetPage: true }) }} aria-label="Xoá từ khoá">✕</button>
          </span>
        )}
        {isFiltered && (
          <button type="button" className="btn btn-secondary" onClick={handleReset} style={{ fontSize: '0.8rem' }}>
            Xoá lọc
          </button>
        )}
      </div>

      {/* ── Results summary bar ── */}
      {state.status === 'success' && totalItems != null && totalItems > 0 && (
        <div className="audit-summary-bar">
          <span>
            Tìm thấy <strong>{totalItems.toLocaleString('vi-VN')}</strong> hoạt động
            {isFiltered && ' (đang lọc)'}
          </span>
        </div>
      )}

      {/* ── Error state ── */}
      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title="Không tải được nhật ký"
          description={state.error}
          actionLabel="Thử lại"
          onAction={handleRefresh}
        />
      )}

      {/* ── Empty state ── */}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={isFiltered ? 'Không tìm thấy kết quả' : 'Chưa có nhật ký'}
          description={isFiltered ? 'Thử thay đổi từ khoá, bộ lọc mục quản lý, người thực hiện hoặc khoảng thời gian.' : 'Chưa có thao tác nào được ghi lại.'}
          {...(isFiltered ? { actionLabel: 'Xoá bộ lọc', onAction: handleReset } : {})}
        />
      )}

      {/* ── Data ── */}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          {/* Desktop: clickable table rows */}
          <div className="audit-table-wrapper">
            <AdminTable
              caption="Danh sách nhật ký hoạt động"
              columns={columns}
              rows={state.items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={handleRowClick}
              rowClassName={(r) => `audit-table-row${DANGEROUS_ACTIONS.has(r.action) ? ' audit-row-danger' : ''}`}
            />
          </div>

          {/* Mobile: card list */}
          <div className="audit-card-list" aria-label="Danh sách nhật ký hoạt động" role="list">
            {state.status === 'loading'
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="audit-card audit-card--skeleton" aria-hidden="true">
                    <div className="skeleton-cell" style={{ width: '60%', height: 14, marginBottom: 8, borderRadius: 4 }} />
                    <div className="skeleton-cell" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                  </div>
                ))
              : state.items.map((log) => (
                  <AuditCard key={log.id} log={log} onClick={() => setSelectedLog(log)} />
                ))
            }
          </div>

          {state.status === 'success' && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </>
      )}

      {/* ── Detail drawer ── */}
      {selectedLog && (
        <AuditDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {/* ── Mobile filter drawer ── */}
      {showMobileFilter && (
        <MobileFilterDrawer
          query={query}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={handleSearch}
          onUpdate={updateQuery}
          onReset={handleReset}
          onClose={() => setShowMobileFilter(false)}
          isFiltered={isFiltered}
        />
      )}
    </section>
  )
}
