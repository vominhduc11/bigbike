import { formatCurrencyVnd, formatDateTime } from '../../lib/formatters'
import { CouponStatusBadge, ChannelBadge } from './badges'
import { renderCouponActions } from './CouponRow'

// Builds the mobileCard object for one coupon (mirrors the desktop columns).
// Returned to AdminTable's `mobileCard` mapper, which renders MobileCard.
export function couponMobileCard({ c, t, canUpdate, onEdit, onToggleStatus, onDelete }) {
  const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : 0
  return {
    title: <span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-primary)' }}>{c.code}</span>,
    subtitle: c.name || '—',
    status: <CouponStatusBadge value={c.status} />,
    meta: [
      {
        label: t('coupons.colDiscount'),
        value: (
          <span className="bb-badge bb-badge-info">
            {c.discountType === 'PERCENT' ? `-${c.discountValue}%` : `-${formatCurrencyVnd(c.discountValue)}`}
          </span>
        ),
      },
      { label: t('coupons.colUsed'), value: `${c.usageCount}${c.maxUsage ? ` / ${c.maxUsage}` : ''}` },
      {
        label: t('coupons.colUsageRate', { defaultValue: 'Tỉ lệ dùng' }),
        value: c.maxUsage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: pct + '%' }} />
            </div>
            <span className="bb-muted" style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
          </div>
        ) : '—',
      },
      { label: t('coupons.colChannel', { defaultValue: 'Kênh' }), value: <ChannelBadge value={c.channel || 'ALL'} /> },
      { label: t('coupons.colExpires'), value: formatDateTime(c.expiresAt) },
    ],
    actions: canUpdate ? renderCouponActions({ c, t, onEdit, onToggleStatus, onDelete }) : undefined,
  }
}
