import { useTranslation } from 'react-i18next'
import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'

function toneFromPublish(status) {
  switch (status) {
    case 'PUBLISHED': return 'success'
    case 'DRAFT':     return 'info'
    case 'HIDDEN':    return 'warning'
    case 'ARCHIVED':  return 'neutral'
    case 'TRASH':     return 'danger'
    default:          return 'neutral'
  }
}

function toneFromStock(status) {
  switch (status) {
    case 'IN_STOCK':          return 'success'
    case 'LOW_STOCK':         return 'warning'
    case 'PREORDER':          return 'info'
    case 'OUT_OF_STOCK':      return 'danger'
    case 'CONTACT_FOR_STOCK': return 'neutral'
    default:                  return 'neutral'
  }
}

// Matches real OrderStatus enum: PENDING / ON_HOLD / PROCESSING / COMPLETED / CANCELLED / FAILED / REFUNDED
const ORDER_STATUS_COLORS = {
  PENDING:    '#d97706',
  ON_HOLD:    '#6b7280',
  PROCESSING: '#7c3aed',
  COMPLETED:  '#16a34a',
  CANCELLED:  '#dc2626',
  FAILED:     '#dc2626',
  REFUNDED:   '#6b7280',
}

export function StatusBadge({ status, type = 'order' }) {
  const { t } = useTranslation()
  const color = type === 'order' ? (ORDER_STATUS_COLORS[status] ?? '#9ca3af') : '#9ca3af'
  const label = type === 'order' ? t(`status.order.${status}`, status) : status
  return (
    <span style={{ color, fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export function PublishStatusBadge({ value }) {
  const { t } = useTranslation()
  const status = normalizePublishStatus(value)
  const tone = toneFromPublish(status)
  return <span className={`status-badge status-${tone}`}>{t(`status.publish.${status}`)}</span>
}

export function StockStatusBadge({ value }) {
  const { t } = useTranslation()
  const status = normalizeStockState(value)
  const tone = toneFromStock(status)
  return <span className={`status-badge status-${tone}`}>{t(`status.stock.${status}`)}</span>
}
