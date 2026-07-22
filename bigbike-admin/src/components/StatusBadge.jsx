import { useTranslation } from 'react-i18next'
import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'
import { ORDER_STATUS_TONE, CUSTOMER_STATUS_TONE, REVIEW_STATUS_TONE, toneFromPublish, toneFromStock } from '../lib/statusTone'

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

  // Trạng thái rỗng (null/undefined/'') ở các loại enum → nhãn "Không xác định" thay vì render key thô
  // ("status.order.undefined") hay chuỗi rỗng. Loại 'visibility' dùng boolean (false = Ẩn là hợp lệ) nên bỏ qua.
  if (type !== 'visibility' && (status === null || status === undefined || status === '')) {
    return <Badge tone="muted" className={className}>{t('common.unknown')}</Badge>
  }

  if (type === 'order') {
    tone = ORDER_STATUS_TONE[status] ?? 'muted'
    label = t(`status.order.${status}`, { defaultValue: status })
  } else if (type === 'visibility') {
    const key = status ? 'VISIBLE' : 'HIDDEN'
    tone = key === 'VISIBLE' ? 'success' : 'neutral'
    label = key === 'VISIBLE' ? t('common.visible') : t('common.hidden')
  } else if (type === 'customer') {
    tone = CUSTOMER_STATUS_TONE[status] ?? 'muted'
    label = t(`status.customer.${status}`, { defaultValue: status })
  } else if (type === 'review') {
    tone = REVIEW_STATUS_TONE[status] ?? 'muted'
    label = t(`reviews.status${String(status).charAt(0) + String(status).slice(1).toLowerCase()}`, { defaultValue: t('common.unknown') })
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
