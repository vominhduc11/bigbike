import { useTranslation } from 'react-i18next'
import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'
import { ORDER_STATUS_TONE, CUSTOMER_STATUS_TONE, REVIEW_STATUS_TONE, toneFromPublish, toneFromStock } from '../lib/statusTone'
import { Badge as UiBadge } from '@/components/ui/badge'

function Badge({ tone = 'muted', className, children }) {
  const variant = tone === 'neutral' ? 'secondary' : tone
  return (
    <UiBadge variant={variant} className={className}>
      {children}
    </UiBadge>
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
    if (status !== true && status !== false) {
      return <Badge tone="muted" className={className}>{t('common.unknown')}</Badge>
    }
    const key = status ? 'VISIBLE' : 'HIDDEN'
    tone = key === 'VISIBLE' ? 'success' : 'neutral'
    label = key === 'VISIBLE' ? t('common.visible') : t('common.hidden')
  } else if (type === 'trash') {
    if (status !== true && status !== false) {
      return <Badge tone="muted" className={className}>{t('common.unknown')}</Badge>
    }
    tone = status ? 'danger' : 'success'
    label = status
      ? t('categories.filterTrash', { defaultValue: 'Thùng rác' })
      : t('categories.activeStatus', { defaultValue: 'Đang hoạt động' })
  } else if (type === 'homepage') {
    if (status !== true && status !== false) {
      return <Badge tone="muted" className={className}>{t('common.unknown')}</Badge>
    }
    tone = status ? 'success' : 'neutral'
    label = status
      ? t('categories.homepageShown', { defaultValue: 'Có trên trang chủ' })
      : t('categories.homepageHidden', { defaultValue: 'Không trên trang chủ' })
  } else if (type === 'customer') {
    tone = CUSTOMER_STATUS_TONE[status] ?? 'muted'
    label = t(`status.customer.${status}`, { defaultValue: status })
  } else if (type === 'source') {
    // Nguồn tài khoản: true = tạo tự động từ đơn hàng cũ khi migrate (không có đăng nhập
    // thật), false = khách đăng ký/OAuth thật. Xem DATA_CONTRACT.md "Customer isSynthetic Flag".
    if (status !== true && status !== false) {
      return <Badge tone="muted" className={className}>{t('common.unknown')}</Badge>
    }
    tone = status ? 'neutral' : 'success'
    label = status
      ? t('customers.sourceSynthetic', { defaultValue: 'Từ đơn hàng cũ' })
      : t('customers.sourceReal', { defaultValue: 'Tài khoản thật' })
  } else if (type === 'review') {
    tone = REVIEW_STATUS_TONE[status] ?? 'muted'
    label = t(`reviews.status${String(status).charAt(0) + String(status).slice(1).toLowerCase()}`, { defaultValue: t('common.unknown') })
  } else if (type === 'adminUser') {
    const adminUserMeta = {
      INVITED: { tone: 'info', labelKey: 'adminUsers.statusInvited' },
      ACTIVE: { tone: 'success', labelKey: 'adminUsers.statusActive' },
      DISABLED: { tone: 'danger', labelKey: 'adminUsers.statusDisabled' },
      SUSPENDED: { tone: 'warning', labelKey: 'adminUsers.statusSuspended' },
    }[status]
    tone = adminUserMeta?.tone ?? 'muted'
    label = adminUserMeta ? t(adminUserMeta.labelKey) : status
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
