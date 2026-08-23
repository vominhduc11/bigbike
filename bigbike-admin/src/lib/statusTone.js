import { normalizePublishStatus } from './contracts'

// Nguồn DUY NHẤT map trạng thái → tone. Dùng chung cho:
//  - badge màu (components/StatusBadge.jsx)
//  - vạch màu trái ở dòng bảng (AdminTable rowClassName, class .bb-row-accent--{tone})
// Nhờ tách khỏi file component, không vi phạm react-refresh/only-export-components.

export const ORDER_STATUS_TONE = {
  PENDING:    'warning',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'neutral',
  UNKNOWN:    'muted',
}

export const CUSTOMER_STATUS_TONE = {
  ACTIVE:   'success',
  PENDING:  'warning',
  DISABLED: 'neutral',
  BLOCKED:  'danger',
  UNKNOWN:  'muted',
}

export const REVIEW_STATUS_TONE = {
  APPROVED: 'success',
  PENDING: 'warning',
  SPAM: 'neutral',
  TRASH: 'neutral',
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

export function customerRowAccent(status) {
  return `bb-row-accent--${CUSTOMER_STATUS_TONE[status] ?? 'muted'}`
}

export function reviewRowAccent(status) {
  return `bb-row-accent--${REVIEW_STATUS_TONE[status] ?? 'muted'}`
}

export function trashRowAccent(inTrash) {
  return `bb-row-accent--${inTrash === true ? 'danger' : inTrash === false ? 'success' : 'muted'}`
}

export function visibilityRowAccent(isVisible) {
  return `bb-row-accent--${isVisible === true ? 'success' : isVisible === false ? 'neutral' : 'muted'}`
}

export function enabledRowAccent(isEnabled) {
  return `bb-row-accent--${isEnabled === true ? 'success' : isEnabled === false ? 'neutral' : 'muted'}`
}
