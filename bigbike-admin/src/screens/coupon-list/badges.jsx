import { useTranslation } from 'react-i18next'
import { STATUS_BADGE, CHANNEL_BADGE, CHANNEL_LABELS } from './constants'

export function CouponStatusBadge({ value }) {
  const { t } = useTranslation()
  const labels = {
    ACTIVE: t('coupons.statusActive'),
    INACTIVE: t('coupons.statusInactive'),
    EXPIRED: t('coupons.statusExpired'),
    ARCHIVED: t('coupons.statusArchived'),
  }
  return (
    <span className={`bb-badge ${STATUS_BADGE[value] || 'bb-badge-neutral'}`}>
      {labels[value] ?? value}
    </span>
  )
}

export function ChannelBadge({ value }) {
  return <span className={`bb-badge ${CHANNEL_BADGE[value] || 'bb-badge-neutral'}`}>{CHANNEL_LABELS[value] ?? value}</span>
}
