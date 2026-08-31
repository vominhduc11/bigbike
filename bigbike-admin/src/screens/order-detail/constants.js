// Constants and pure helpers for OrderDetailScreen.
// Extracted from OrderDetailScreen.jsx to keep the screen file focused on
// behaviour and to keep fast-refresh happy (non-component exports live in .js).

export const REASON_REQUIRED = new Set(['CANCELLED'])

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
  PROCESSING: { labelKey: 'orders.detail.actionProcessing', variant: 'primary', confirm: false },
  COMPLETED: { labelKey: 'orders.detail.actionCompleted', variant: 'success', confirm: true },
  CANCELLED: { labelKey: 'orders.detail.actionCancelled', variant: 'destructive', confirm: true },
}

export function getOrderStatusLabel(targetStatus, order, t) {
  const key = ORDER_STATUS_ACTION[targetStatus]?.labelKey
  if (key) return t(key)
  return t(`status.order.${targetStatus}`, { defaultValue: t('common.unknown') })
}

export function getOrderMutationError(error, t) {
  switch (Number(error?.status)) {
    case 400:
      return t('orders.detail.errorValidation')
    case 403:
      return t('orders.detail.errorForbidden')
    case 404:
      return t('orders.detail.errorNotFound')
    case 409:
      return t('orders.detail.errorConflict')
    default:
      if (
        error instanceof TypeError ||
        error?.code === 'NETWORK_ERROR' ||
        /failed to fetch|network/i.test(String(error?.message ?? ''))
      ) {
        return t('orders.detail.errorNetwork')
      }
      return t('orders.detail.updateStatusError')
  }
}

export function parseOrderAuditData(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function getOrderAuditDetails(entry, t) {
  const before = parseOrderAuditData(entry?.beforeData)
  const after = parseOrderAuditData(entry?.afterData)
  const fromStatus = typeof before.status === 'string' ? before.status : ''
  const toStatus = typeof after.status === 'string' ? after.status : ''
  const transition =
    fromStatus && toStatus
      ? t('orders.audit.transition', {
          from: t(`status.order.${fromStatus}`, { defaultValue: t('common.unknown') }),
          to: t(`status.order.${toStatus}`, { defaultValue: t('common.unknown') }),
        })
      : ''
  const cancelReason = typeof after.cancelReason === 'string' ? after.cancelReason.trim() : ''
  return { transition, cancelReason }
}
