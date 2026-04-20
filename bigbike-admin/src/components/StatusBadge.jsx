import { normalizePublishStatus, normalizeStockState } from '../lib/contracts'

const PUBLISH_LABELS = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  HIDDEN: 'Hidden',
  ARCHIVED: 'Archived',
  UNKNOWN: 'Unknown',
}

const STOCK_LABELS = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  PREORDER: 'Preorder',
  CONTACT_FOR_STOCK: 'Contact for stock',
  UNKNOWN: 'Unknown',
}

function toneFromPublish(status) {
  switch (status) {
    case 'PUBLISHED':
      return 'success'
    case 'DRAFT':
      return 'info'
    case 'HIDDEN':
      return 'warning'
    case 'ARCHIVED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function toneFromStock(status) {
  switch (status) {
    case 'IN_STOCK':
      return 'success'
    case 'LOW_STOCK':
      return 'warning'
    case 'PREORDER':
      return 'info'
    case 'OUT_OF_STOCK':
      return 'danger'
    case 'CONTACT_FOR_STOCK':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function PublishStatusBadge({ value }) {
  const status = normalizePublishStatus(value)
  const tone = toneFromPublish(status)

  return <span className={`status-badge status-${tone}`}>{PUBLISH_LABELS[status]}</span>
}

export function StockStatusBadge({ value }) {
  const status = normalizeStockState(value)
  const tone = toneFromStock(status)

  return <span className={`status-badge status-${tone}`}>{STOCK_LABELS[status]}</span>
}
