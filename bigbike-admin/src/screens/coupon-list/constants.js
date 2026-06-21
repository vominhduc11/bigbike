// Query defaults, badge palettes and pure helpers for CouponListScreen.
// Extracted from CouponListScreen.jsx so the screen file stays behaviour-focused
// and fast-refresh only sees components in the .jsx files.

// Coupon status → prototype badge palette.
export const STATUS_BADGE = { ACTIVE: 'bb-badge-success', INACTIVE: 'bb-badge-neutral', EXPIRED: 'bb-badge-danger', ARCHIVED: 'bb-badge-neutral' }
export const CHANNEL_BADGE = { ALL: 'bb-badge-neutral', ONLINE: 'bb-badge-info', POS: 'bb-badge-warning' }
export const CHANNEL_LABELS = { ALL: 'Tất cả kênh', ONLINE: 'Chỉ online', POS: 'Chỉ tại quầy' }

export const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }
export const EMPTY_FORM = { code: '', name: '', discountType: 'FIXED', discountValue: '', minimumOrderAmount: '', maxUsage: '', expiresAt: '', channel: 'ALL' }

// Convert "YYYY-MM-DD" date picker value to end-of-day Vietnam time ISO instant.
export function toEndOfDayInstant(dateStr) {
  if (!dateStr) return undefined
  return dateStr + 'T23:59:59+07:00'
}
