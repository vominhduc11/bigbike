// Constants and pure helpers for PosScreen.
// Extracted from PosScreen.jsx to keep the screen file focused on behaviour
// and to satisfy fast-refresh (non-component exports live in .js).

export const PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL', 'CREDIT']

export const POS_CART_KEY = 'pos_cart'
export const POS_CART_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export function priceOf(priceObj) {
  if (priceObj == null) return 0
  if (typeof priceObj === 'number') return priceObj
  return Number(priceObj.salePrice ?? priceObj.retailPrice ?? 0)
}

export function summarizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return ''
  return options.map((o) => o.value ?? o.name ?? '').filter(Boolean).join(' / ')
}

export function effectivePrice(item) {
  return item.overriddenPrice != null ? item.overriddenPrice : item.price
}

export function printReceipt(order, cart, cardRef) {
  const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
  const items = cart || []
  const total = order?.totalAmount != null
    ? Number(order.totalAmount)
    : items.reduce((s, c) => s + effectivePrice(c) * c.qty, 0)
  const discountAmt = order?.discountAmount ? Number(order.discountAmount) : 0
  const couponCode = order?.couponCode || null
  const dateStr = new Date().toLocaleString('vi-VN')
  const methodLabel = { CASH: 'Tiền mặt', CARD_TERMINAL: 'Quẹt thẻ', CREDIT: 'Bán chịu' }
  const method = methodLabel[order?.paymentMethod] || order?.paymentMethod || '—'
  const rows = items.map((item) => `
    <tr>
      <td>${item.productName}${item.variantName ? `<br><small>${item.variantName}</small>` : ''}</td>
      <td class="r">${item.qty}</td>
      <td class="r">${fmt(effectivePrice(item))}</td>
      <td class="r">${fmt(effectivePrice(item) * item.qty)}</td>
    </tr>`).join('')
  const discountRow = discountAmt > 0
    ? `<tr><td colspan="3">Giảm giá${couponCode ? ` (${couponCode})` : ''}</td><td class="r" style="color:green">-${fmt(discountAmt)}</td></tr>`
    : ''
  const changeRow = order?.changeAmount > 0
    ? `<tr><td colspan="3">Tiền thừa trả lại</td><td class="r">${fmt(order.changeAmount)}</td></tr>`
    : (order?.paymentMethod === 'CASH' && !order?.tenderedAmount
      ? `<tr><td colspan="4" style="color:#888;font-style:italic">Tiền khách đưa: Chưa ghi nhận</td></tr>`
      : '')
  const customerInfo = (order?.customerName || order?.customerPhone)
    ? `<p style="margin:2px 0">Khách: ${order.customerName || ''}${order.customerPhone ? ' — ' + order.customerPhone : ''}</p>`
    : ''
  const cardRefRow = cardRef
    ? `<p style="margin:2px 0">Ref thẻ: ${cardRef}</p>`
    : ''
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Hóa đơn ${order?.orderNumber || ''}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:320px;margin:0 auto;padding:12px}
  h2{text-align:center;margin:0 0 2px}
  .center{text-align:center}
  .sep{border:none;border-top:1px dashed #000;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  td,th{padding:3px 2px;vertical-align:top}
  th{border-bottom:1px solid #000;text-align:left}
  .r{text-align:right;white-space:nowrap}
  .total-row td{border-top:1px solid #000;font-weight:bold}
  small{color:#555}
  @media print{@page{margin:6mm}}
</style></head>
<body>
<h2 style="text-align:center">BigBike — Phụ kiện mô tô</h2>
<p class="center" style="margin:2px 0">Hóa đơn bán hàng tại quầy</p>
<hr class="sep">
<p style="margin:2px 0">Số đơn: <strong>${order?.orderNumber || '—'}</strong></p>
<p style="margin:2px 0">Ngày: ${dateStr}</p>
<p style="margin:2px 0">Thanh toán: <strong>${method}</strong></p>
${customerInfo}${cardRefRow}<hr class="sep">
<table>
  <thead><tr><th>Sản phẩm</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">T.tiền</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    ${discountRow}
    <tr class="total-row"><td colspan="3">Tổng cộng</td><td class="r">${fmt(total)}</td></tr>
    ${changeRow}
  </tfoot>
</table>
<hr class="sep">
<p class="center" style="margin-top:12px">Cảm ơn quý khách!</p>
</body></html>`

  const w = window.open('', '_blank', 'width=420,height=640')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
    return
  }
  // Fallback: hidden iframe khi browser chặn popup
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;height:640px;border:none'
  document.body.appendChild(iframe)
  try {
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch { /* print best-effort */ }
      setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* already removed */ } }, 1000)
    }, 300)
  } catch { /* iframe print unsupported */
    try { document.body.removeChild(iframe) } catch { /* already removed */ }
  }
}
