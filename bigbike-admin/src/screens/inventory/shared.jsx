import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Package, XCircle } from 'lucide-react'
import { SERIAL_STATUS_LABELS, SERIAL_STATUS_CLASSES } from '../../lib/serialStateMachine'
import { MOVEMENT_TYPE_CLASSES } from './constants'

export function ProductThumbnail({ image, alt, size = 40 }) {
  const [errored, setErrored] = useState(false)
  const src = image?.url
  const label = image?.alt || alt || ''

  if (!src || errored) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, flexShrink: 0,
          fontSize: size * 0.45,
        }}
        className="rounded-sm bg-surface-muted border border-border text-muted-foreground"
      >
        ◻
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      style={{
        width: size, height: size, flexShrink: 0,
        objectFit: 'cover',
        display: 'block',
      }}
      className="rounded-sm border border-border"
    />
  )
}

export function MovementTypeBadge({ type }) {
  return (
    <span className={`font-semibold text-xs ${MOVEMENT_TYPE_CLASSES[type] ?? 'text-muted-foreground'}`}>
      {type}
    </span>
  )
}

export function SummaryBanner({ summary }) {
  const { t } = useTranslation()
  if (!summary || summary.totalItems === 0) return null
  const inStock = Math.max(
    0,
    summary.totalItems - (summary.lowStockCount || 0) - (summary.outOfStockCount || 0),
  )
  return (
    <div className="bb-kpi-grid">
      <div className="bb-kpi">
        <div className="bb-kpi-head">
          <span className="bb-kpi-icon info"><Package size={15} /></span>
          <span>{t('inventory.summary.totalItems')}</span>
        </div>
        <div className="bb-kpi-value">{summary.totalItems.toLocaleString('vi-VN')}</div>
      </div>
      <div className="bb-kpi">
        <div className="bb-kpi-head">
          <span className="bb-kpi-icon success"><CheckCircle size={15} /></span>
          <span>{t('status.stock.IN_STOCK')}</span>
        </div>
        <div className="bb-kpi-value">{inStock.toLocaleString('vi-VN')}</div>
      </div>
      <div className="bb-kpi">
        <div className="bb-kpi-head">
          <span className="bb-kpi-icon warning"><AlertTriangle size={15} /></span>
          <span>{t('inventory.summary.lowStock')}</span>
        </div>
        <div className="bb-kpi-value">{(summary.lowStockCount || 0).toLocaleString('vi-VN')}</div>
      </div>
      <div className="bb-kpi">
        <div className="bb-kpi-head">
          <span className="bb-kpi-icon danger"><XCircle size={15} /></span>
          <span>{t('inventory.summary.outOfStock')}</span>
        </div>
        <div className="bb-kpi-value">{(summary.outOfStockCount || 0).toLocaleString('vi-VN')}</div>
      </div>
    </div>
  )
}

export function SerialStatusBadge({ status }) {
  const label = SERIAL_STATUS_LABELS[status] || status
  const classes = SERIAL_STATUS_CLASSES[status] || 'text-muted-foreground bg-muted'
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${classes}`}>{label}</span>
}
