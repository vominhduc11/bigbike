import { useTranslation } from 'react-i18next'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { formatCurrencyVnd, formatDateTime } from '../../lib/formatters'
import { CouponStatusBadge, ChannelBadge } from './badges'

// Desktop table row for one coupon.
export function CouponRow({ c, canUpdate, onEdit, onToggleStatus, onDelete }) {
  const { t } = useTranslation()
  const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : 0
  return (
    <tr>
      <td>
        <span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-primary)' }}>{c.code}</span>
      </td>
      <td>{c.name || '—'}</td>
      <td>
        <span className="bb-badge bb-badge-info">
          {c.discountType === 'PERCENT' ? `-${c.discountValue}%` : `-${formatCurrencyVnd(c.discountValue)}`}
        </span>
      </td>
      <td className="num">{c.usageCount}{c.maxUsage ? ` / ${c.maxUsage}` : ''}</td>
      <td style={{ minWidth: 140 }}>
        {c.maxUsage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="stock-bar"><div style={{ width: pct + '%' }} /></div>
            <span className="bb-muted" style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
          </div>
        ) : (
          <span className="bb-muted" style={{ fontSize: 12 }}>—</span>
        )}
      </td>
      <td><ChannelBadge value={c.channel || 'ALL'} /></td>
      <td className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(c.expiresAt)}</td>
      <td><CouponStatusBadge value={c.status} /></td>
      {canUpdate && (
        <td className="col-actions">
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
        </td>
      )}
    </tr>
  )
}
