import { useTranslation } from 'react-i18next'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { MobileCard } from '../../components/layout/MobileCardList'
import { formatCurrencyVnd, formatDateTime } from '../../lib/formatters'
import { CouponStatusBadge, ChannelBadge } from './badges'

// Mobile card for one coupon (mirrors CouponRow content).
export function CouponMobileCard({ c, canUpdate, onEdit, onToggleStatus, onDelete }) {
  const { t } = useTranslation()
  const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : 0
  return (
    <MobileCard
      title={<span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-primary)' }}>{c.code}</span>}
      subtitle={c.name || '—'}
      status={<CouponStatusBadge value={c.status} />}
      meta={[
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
          label: 'Tỉ lệ dùng',
          value: c.maxUsage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="stock-bar"><div style={{ width: pct + '%' }} /></div>
              <span className="bb-muted" style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
            </div>
          ) : '—',
        },
        { label: 'Kênh', value: <ChannelBadge value={c.channel || 'ALL'} /> },
        { label: t('coupons.colExpires'), value: formatDateTime(c.expiresAt) },
      ]}
      actions={canUpdate ? (
        <>
          <button type="button" className="bb-icon-btn" title={t('common.edit')} onClick={() => onEdit(c)}>
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="bb-icon-btn"
            title={c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
            onClick={() => onToggleStatus(c)}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="bb-icon-btn"
            title={t('common.delete')}
            onClick={() => onDelete(c)}
          >
            <Trash2 size={14} />
          </button>
        </>
      ) : undefined}
    />
  )
}
