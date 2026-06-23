import { useTranslation } from 'react-i18next'
import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'

const ORDER_STATUS_TONE = {
  PENDING:    'warning',
  ON_HOLD:    'warning',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'neutral',
  FAILED:     'danger',
  REFUNDED:   'warning',
  UNKNOWN:    'muted',
}

const PAYMENT_STATUS_TONE = {
  PENDING:   'warning',
  UNPAID:    'warning',
  PAID:      'success',
  REFUNDED:  'warning',
  CANCELLED: 'neutral',
  FAILED:    'danger',
  UNKNOWN:   'muted',
}

function toneFromPublish(status) {
  switch (status) {
    case 'PUBLISHED': return 'success'
    case 'DRAFT':     return 'info'
    case 'HIDDEN':    return 'warning'
    case 'TRASH':     return 'danger'
    default:          return 'muted'
  }
}

function toneFromStock(status) {
  switch (status) {
    case 'IN_STOCK':     return 'success'
    case 'OUT_OF_STOCK': return 'danger'
    default:             return 'muted'
  }
}

function Badge({ tone = 'muted', className, children }) {
  return (
    <span className={`bb-badge bb-badge-${tone}${className ? ` ${className}` : ''}`}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  )
}

export function StatusBadge({ status, type = 'order', className }) {
  const { t } = useTranslation()
  let tone = 'muted'
  let label = status

  if (type === 'order') {
    tone = ORDER_STATUS_TONE[status] ?? 'muted'
    label = t(`status.order.${status}`, { defaultValue: status })
  } else if (type === 'payment') {
    tone = PAYMENT_STATUS_TONE[status] ?? 'muted'
    label = t(`status.payment.${status}`, { defaultValue: status })
  } else if (type === 'visibility') {
    const key = status ? 'VISIBLE' : 'HIDDEN'
    tone = key === 'VISIBLE' ? 'success' : 'neutral'
    label = key === 'VISIBLE' ? t('common.visible') : t('common.hidden')
  }

  return <Badge tone={tone} className={className}>{label}</Badge>
}

export function PublishStatusBadge({ value }) {
  const { t } = useTranslation()
  const status = normalizePublishStatus(value)
  return <Badge tone={toneFromPublish(status)}>{t(`status.publish.${status}`)}</Badge>
}

export function StockStatusBadge({ value }) {
  const { t } = useTranslation()
  const status = normalizeStockState(value)
  return <Badge tone={toneFromStock(status)}>{t(`status.stock.${status}`)}</Badge>
}
