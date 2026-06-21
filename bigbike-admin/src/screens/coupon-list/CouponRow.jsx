import { Pencil, Power, Trash2 } from 'lucide-react'
import { formatCurrencyVnd, formatDateTime } from '../../lib/formatters'
import { CouponStatusBadge, ChannelBadge } from './badges'

// Inline icon-only action buttons for one coupon (desktop table cell + reused
// inside the mobile card). title + aria-label keep an accessible name even when
// title is not announced; Power icon reflects activate/deactivate.
// Plain render helper (not a component export) so this .jsx can also export the
// non-component column/card builders without tripping fast-refresh.
export function renderCouponActions({ c, t, onEdit, onToggleStatus, onDelete }) {
  return (
    <>
      <button type="button" className="bb-icon-btn" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => onEdit(c)}>
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="bb-icon-btn"
        title={c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
        aria-label={c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
        onClick={() => onToggleStatus(c)}
      >
        <Power size={14} />
      </button>
      <button
        type="button"
        className="bb-icon-btn"
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => onDelete(c)}
      >
        <Trash2 size={14} />
      </button>
    </>
  )
}

// Usage-rate bar (track + filled portion) using design tokens via Tailwind
// utilities. Replaces the previously-undefined .stock-bar class. Lowercase
// render helper (not a component) so the file's only exports stay non-components.
function renderUsageBar(pct) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: pct + '%' }} />
      </div>
      <span className="bb-muted" style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function usagePct(c) {
  return c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : 0
}

// Column definitions for the coupons AdminTable. Handlers + t are threaded from
// the screen so the cells stay presentational.
export function couponColumns({ t, canUpdate, onEdit, onToggleStatus, onDelete }) {
  const cols = [
    {
      key: 'code',
      label: t('coupons.colCode'),
      skeletonWidth: '60%',
      render: (c) => <span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-primary)' }}>{c.code}</span>,
    },
    { key: 'name', label: t('coupons.colName'), render: (c) => c.name || '—' },
    {
      key: 'discount',
      label: t('coupons.colDiscount'),
      render: (c) => (
        <span className="bb-badge bb-badge-info">
          {c.discountType === 'PERCENT' ? `-${c.discountValue}%` : `-${formatCurrencyVnd(c.discountValue)}`}
        </span>
      ),
    },
    {
      key: 'used',
      label: t('coupons.colUsed'),
      align: 'right',
      render: (c) => `${c.usageCount}${c.maxUsage ? ` / ${c.maxUsage}` : ''}`,
    },
    {
      key: 'usageRate',
      label: t('coupons.colUsageRate', { defaultValue: 'Tỉ lệ dùng' }),
      render: (c) => (c.maxUsage ? renderUsageBar(usagePct(c)) : <span className="bb-muted" style={{ fontSize: 12 }}>—</span>),
    },
    {
      key: 'channel',
      label: t('coupons.colChannel', { defaultValue: 'Kênh' }),
      render: (c) => <ChannelBadge value={c.channel || 'ALL'} />,
    },
    {
      key: 'expires',
      label: t('coupons.colExpires'),
      render: (c) => <span className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(c.expiresAt)}</span>,
    },
    { key: 'status', label: t('coupons.colStatus'), render: (c) => <CouponStatusBadge value={c.status} /> },
  ]
  if (canUpdate) {
    cols.push({
      key: 'actions',
      label: '',
      align: 'right',
      render: (c) => (
        <div className="flex gap-1 justify-end">
          {renderCouponActions({ c, t, onEdit, onToggleStatus, onDelete })}
        </div>
      ),
    })
  }
  return cols
}
