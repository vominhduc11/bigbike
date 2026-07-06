// Constants and pure helpers for OrderDetailScreen.
// Extracted from OrderDetailScreen.jsx to keep the screen file focused on
// behaviour and to keep fast-refresh happy (non-component exports live in .js).

export const PAYMENT_TRANSITIONS = {
  UNPAID:    ['PAID', 'CANCELLED'],
  PAID:      ['UNPAID'],
  CANCELLED: [],
}

export const REASON_REQUIRED = new Set(['CANCELLED', 'FAILED'])

// Ghép phần đường/phường/quận/tỉnh của một địa chỉ thành 1 dòng (bỏ phần rỗng).
export function addressLine(addr) {
  if (!addr) return ''
  return [addr.addressLine1, addr.addressLine2, addr.ward, addr.district, addr.province]
    .filter(Boolean)
    .join(', ')
}

// So sánh địa chỉ thanh toán vs giao hàng để chỉ hiện địa chỉ thanh toán khi KHÁC nhau.
export function sameAddress(a, b) {
  if (!a || !b) return false
  return a.fullName === b.fullName && a.phone === b.phone && addressLine(a) === addressLine(b)
}

export const ORDER_STATUS_ACTION = {
  PROCESSING: { labelKey: 'orders.detail.actionProcessing', variant: 'primary',     confirm: false },
  ON_HOLD:    { labelKey: 'orders.detail.actionOnHold',     variant: 'secondary',   confirm: false },
  COMPLETED:  { labelKey: 'orders.detail.actionCompleted',  variant: 'success',     confirm: true  },
  CANCELLED:  { labelKey: 'orders.detail.actionCancelled',  variant: 'destructive', confirm: true  },
  FAILED:     { labelKey: 'orders.detail.actionFailed',     variant: 'destructive', confirm: true  },
}

export function getOrderStatusLabel(targetStatus, order, t) {
  if (targetStatus === 'PROCESSING' && order?.orderStatus === 'ON_HOLD' && order?.paymentMethod === 'BACS') {
    return t('orders.detail.actionBacsConfirm')
  }
  const key = ORDER_STATUS_ACTION[targetStatus]?.labelKey
  return key ? t(key) : targetStatus
}

export const PAYMENT_ACTION_LABEL = {
  PAID:      'orders.detail.payActionPaid',
  UNPAID:    'orders.detail.payActionUnpaid',
  CANCELLED: 'orders.detail.payActionCancelled',
}
