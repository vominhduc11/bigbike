import { useTranslation } from 'react-i18next'
import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'
import { Badge } from '@/components/ui/badge'

const ORDER_STATUS_VARIANT = {
  PENDING:    'warning',
  ON_HOLD:    'muted',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'danger',
  FAILED:     'danger',
  REFUNDED:   'muted',
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

export function StatusBadge({ status, type = 'order' }) {
  const { t } = useTranslation()
  const variant = type === 'order' ? (ORDER_STATUS_VARIANT[status] ?? 'muted') : 'muted'
  const label = type === 'order' ? t(`status.order.${status}`, status) : status
  return <Badge variant={variant}>{label}</Badge>
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
