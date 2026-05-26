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

const RETURN_STATUS_TONE = {
  PENDING:    'warning',
  APPROVED:   'info',
  RECEIVED:   'info',
  INSPECTING: 'info',
  COMPLETED:  'success',
  REFUNDED:   'success',
  REJECTED:   'danger',
}

const WARRANTY_STATUS_TONE = {
  ACTIVE:  'success',
  EXPIRED: 'warning',
  VOIDED:  'danger',
}

const SERIAL_STATUS_TONE = {
  IN_STOCK:   'success',
  RESERVED:   'info',
  SOLD:       'neutral',
  RETURNED:   'warning',
  INSPECTION: 'info',
  DAMAGED:    'danger',
  SCRAPPED:   'neutral',
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
    case 'LOW_STOCK':    return 'warning'
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
  } else if (type === 'return') {
    tone = RETURN_STATUS_TONE[status] ?? 'muted'
    label = t(`returns.status.${status}`, { defaultValue: status })
  } else if (type === 'warranty') {
    tone = WARRANTY_STATUS_TONE[status] ?? 'muted'
    label = t(`warranty.status.${status}`, { defaultValue: status })
  } else if (type === 'serial') {
    tone = SERIAL_STATUS_TONE[status] ?? 'muted'
    label = t(`serial.status.${status}`, { defaultValue: status })
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
