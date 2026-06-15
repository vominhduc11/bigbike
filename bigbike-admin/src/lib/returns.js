// Logic quyết định số tiền hoàn cho phiếu đổi/trả (RMA). Tách khỏi ReturnListScreen
// để unit-test (đây là phần đụng tiền nên cần test kỹ).

/**
 * Tổng giá trị các món được trả, loại các món kiểm tra FAIL (không hoàn tiền cho hàng
 * khách làm hỏng — đồng bộ với restoreStockForReturn bỏ qua món FAIL ở backend).
 */
export function computeReturnedItemsValue(items) {
  return (items ?? [])
    .filter((i) => i.inspectionResult !== 'FAIL')
    .reduce((sum, i) => sum + Number(i.unitPrice || 0) * Number(i.quantity || 0), 0)
}

/**
 * Số tiền hoàn gợi ý điền sẵn:
 *  - full coverage  → toàn bộ số còn lại có thể hoàn.
 *  - partial coverage → giá trị các món được trả, chặn trần ở số còn lại có thể hoàn.
 */
export function suggestedRefundAmount({ isPartialCoverage, returnedItemsValue, refundableAmount }) {
  return isPartialCoverage
    ? Math.min(returnedItemsValue || refundableAmount, refundableAmount)
    : refundableAmount
}

/**
 * Kiểm tra số tiền hoàn khi chuyển RMA sang REFUNDED. Trả mã lỗi hoặc null nếu hợp lệ.
 *  - 'required'  : số tiền phải > 0.
 *  - 'exceeds'   : (partial) không được vượt số còn lại có thể hoàn.
 *  - 'mustMatch' : (full) phải đúng bằng số còn lại (RefundService full-only).
 */
export function validateRefundAmount({ amount, refundableAmount, isPartialCoverage }) {
  if (!(amount > 0)) return 'required'
  if (refundableAmount > 0) {
    if (isPartialCoverage) {
      if (amount > refundableAmount) return 'exceeds'
    } else if (amount !== refundableAmount) {
      return 'mustMatch'
    }
  }
  return null
}
