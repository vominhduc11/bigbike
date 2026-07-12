import { normalizePublishStatus } from './contracts'

// Nguồn DUY NHẤT map trạng thái → tone. Dùng chung cho:
//  - badge màu (components/StatusBadge.jsx)
//  - vạch màu trái ở dòng bảng (AdminTable rowClassName, class .bb-row-accent--{tone})
// Nhờ tách khỏi file component, không vi phạm react-refresh/only-export-components.

export const ORDER_STATUS_TONE = {
  PENDING:    'warning',
  ON_HOLD:    'warning',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'neutral',
  FAILED:     'danger',
  UNKNOWN:    'muted',
}

export const PAYMENT_STATUS_TONE = {
  PENDING:   'warning',
  UNPAID:    'warning',
  PAID:      'success',
  CANCELLED: 'neutral',
  FAILED:    'danger',
  UNKNOWN:   'muted',
}

export const CUSTOMER_STATUS_TONE = {
  ACTIVE:   'success',
  PENDING:  'warning',
  DISABLED: 'neutral',
  BLOCKED:  'danger',
  UNKNOWN:  'muted',
}

export const FULFILLMENT_STATUS_TONE = {
  UNFULFILLED: 'neutral',
  PROCESSING:  'info',
  SHIPPED:     'warning',
  DELIVERED:   'success',
  CANCELLED:   'danger',
  UNKNOWN:     'muted',
}

export function toneFromPublish(status) {
  switch (status) {
    case 'PUBLISHED': return 'success'
    case 'DRAFT':     return 'info'
    case 'HIDDEN':    return 'warning'
    case 'TRASH':     return 'danger'
    default:          return 'muted'
  }
}

export function toneFromStock(status) {
  switch (status) {
    case 'IN_STOCK':     return 'success'
    case 'OUT_OF_STOCK': return 'danger'
    default:             return 'muted'
  }
}

// ── Row accent helpers (vạch màu trái theo trạng thái, cho AdminTable rowClassName) ──
// Trả về class `.bb-row-accent--{tone}` khớp màu với chấm badge cùng dòng.
export function publishRowAccent(value) {
  return `bb-row-accent--${toneFromPublish(normalizePublishStatus(value))}`
}

export function orderRowAccent(status) {
  return `bb-row-accent--${ORDER_STATUS_TONE[status] ?? 'muted'}`
}
