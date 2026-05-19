import { useTranslation } from 'react-i18next'
import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'
import { Badge } from '@/components/ui/badge'

const ORDER_STATUS_VARIANT = {
  PENDING:    'warning',
  ON_HOLD:    'warning',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'danger',
  FAILED:     'danger',
  REFUNDED:   'warning',
  UNKNOWN:    'muted',
}

const PAYMENT_STATUS_VARIANT = {
  PENDING:   'warning',
  UNPAID:    'warning',
  PAID:      'success',
  REFUNDED:  'warning',
  CANCELLED: 'danger',
  FAILED:    'danger',
  UNKNOWN:   'muted',
}

const VISIBILITY_STATUS_VARIANT = {
  VISIBLE: 'success',
  HIDDEN: 'muted',
}

const RETURN_STATUS_VARIANT = {
  PENDING:    'warning',
  APPROVED:   'info',
  RECEIVED:   'info',
  INSPECTING: 'info',
  COMPLETED:  'success',
  REFUNDED:   'success',
  REJECTED:   'danger',
}

const WARRANTY_STATUS_VARIANT = {
  ACTIVE:  'success',
  EXPIRED: 'warning',
  VOIDED:  'danger',
}

const SERIAL_STATUS_VARIANT = {
  IN_STOCK:   'success',
  RESERVED:   'info',
  SOLD:       'muted',
  RETURNED:   'warning',
  INSPECTION: 'info',
  DAMAGED:    'danger',
  SCRAPPED:   'muted',
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

export function StatusBadge({ status, type = 'order', className }) {
  const { t } = useTranslation()
  let variant = 'muted'
  let label = status

  if (type === 'order') {
    variant = ORDER_STATUS_VARIANT[status] ?? 'muted'
    label = t(`status.order.${status}`, { defaultValue: status })
  } else if (type === 'payment') {
    variant = PAYMENT_STATUS_VARIANT[status] ?? 'muted'
    label = t(`status.payment.${status}`, { defaultValue: status })
  } else if (type === 'visibility') {
    const key = status ? 'VISIBLE' : 'HIDDEN'
    variant = VISIBILITY_STATUS_VARIANT[key]
    label = key === 'VISIBLE' ? t('common.visible') : t('common.hidden')
  } else if (type === 'return') {
    variant = RETURN_STATUS_VARIANT[status] ?? 'muted'
    label = t(`returns.status.${status}`, { defaultValue: status })
  } else if (type === 'warranty') {
    variant = WARRANTY_STATUS_VARIANT[status] ?? 'muted'
    label = t(`warranty.status.${status}`, { defaultValue: status })
  } else if (type === 'serial') {
    variant = SERIAL_STATUS_VARIANT[status] ?? 'muted'
    label = t(`serial.status.${status}`, { defaultValue: status })
  }

  return <Badge variant={variant} className={className}>{label}</Badge>
}

export function PublishStatusBadge({ value }) {
  const { t } = useTranslation()
  const status = normalizePublishStatus(value)
  return <Badge variant={toneFromPublish(status)}>{t(`status.publish.${status}`)}</Badge>
}

export function StockStatusBadge({ value }) {
  const { t } = useTranslation()
  const status = normalizeStockState(value)
  return <Badge variant={toneFromStock(status)}>{t(`status.stock.${status}`)}</Badge>
}
