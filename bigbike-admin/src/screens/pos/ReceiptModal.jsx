import { useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCurrencyVnd } from '../../lib/formatters'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { effectivePrice, printReceipt } from './constants'
import { RefundDialog } from './RefundDialog'

export function ReceiptModal({ order, paymentMethod, cart, canRefund, onClose }) {
  const { t } = useTranslation()
  const isCreditOrder = paymentMethod === 'CREDIT' || order?.paymentMethod === 'CREDIT'
  // Prefer items from BE response (survives page reload); fall back to cart snapshot
  const items = (order?.items?.length
    ? order.items.map((it, i) => ({
        cartKey: `be-${i}`,
        productName: it.productName,
        variantName: it.variantName,
        sku: it.sku,
        qty: it.quantity,
        price: Number(it.unitPrice),
        overriddenPrice: null,
        hasSerial: false,
      }))
    : null) || cart || []
  const total = order?.totalAmount != null
    ? Number(order.totalAmount)
    : items.reduce((s, c) => s + effectivePrice(c) * c.qty, 0)
  const hasSerialItems = (cart || []).some((it) => it.hasSerial === true)
  const canHaveRefund = order?.paymentStatus === 'PAID'
  const [refundedAmount, setRefundedAmount] = useState(0)
  const [showRefund, setShowRefund] = useState(false)
  // Use paidAmount from BE when available; fall back to cart total for legacy PAID orders
  const effectivePaid = order?.paidAmount != null ? Number(order.paidAmount) : (order?.paymentStatus === 'PAID' ? total : 0)
  const alreadyRefunded = (order?.refundAmount != null ? Number(order.refundAmount) : 0) + refundedAmount
  const refundableRemaining = canHaveRefund ? Math.max(0, effectivePaid - alreadyRefunded) : 0
  const canRefundAction = canHaveRefund && refundableRemaining > 0
  return (
    <Modal open title={t('pos.success')} onClose={onClose}>
        <div className="text-center mb-4">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success mx-auto">
            <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
          </svg>
          <p className="text-sm text-muted-foreground mt-2 mb-0">
            {t('pos.orderNumber')}: <strong>{order?.orderNumber || '—'}</strong>
          </p>
        </div>

        {items.length > 0 && (
          <table className="w-full border-collapse text-xs mb-3">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-1.5 py-1 font-semibold">Sản phẩm</th>
                <th className="text-right px-1.5 py-1 font-semibold">SL</th>
                <th className="text-right px-1.5 py-1 font-semibold">Đơn giá</th>
                <th className="text-right px-1.5 py-1 font-semibold">T.tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.cartKey}>
                  <td className="px-1.5 py-1">
                    <div>{item.productName}</div>
                    {item.variantName && <div className="text-xs text-muted-foreground">{item.variantName}</div>}
                  </td>
                  <td className="text-right px-1.5 py-1">{item.qty}</td>
                  <td className="text-right px-1.5 py-1 whitespace-nowrap">
                    {formatCurrencyVnd(effectivePrice(item))}
                    {item.overriddenPrice != null && (
                      <div className="text-xs text-muted-foreground line-through">
                        {formatCurrencyVnd(item.price)}
                      </div>
                    )}
                  </td>
                  <td className="text-right px-1.5 py-1 whitespace-nowrap">{formatCurrencyVnd(effectivePrice(item) * item.qty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Number(order?.discountAmount) > 0 && (
                <tr>
                  <td colSpan={3} className="px-1.5 pt-1.5 text-right text-sm text-success">
                    Giảm giá{order.couponCode ? ` (${order.couponCode})` : ''}
                  </td>
                  <td className="px-1.5 pt-1.5 text-right text-sm text-success whitespace-nowrap">
                    -{formatCurrencyVnd(Number(order.discountAmount))}
                  </td>
                </tr>
              )}
              <tr className="border-t border-border font-bold">
                <td colSpan={3} className="px-1.5 pt-1.5 pb-0.5 text-right">Tổng cộng</td>
                <td className="px-1.5 pt-1.5 pb-0.5 text-right whitespace-nowrap">{formatCurrencyVnd(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {isCreditOrder && (
          <p className="text-sm mb-2 text-warning text-center">
            Công nợ: <strong>{order?.paymentStatus || 'UNPAID'}</strong>
          </p>
        )}
        {!isCreditOrder && order?.changeAmount != null && order.changeAmount > 0 && (
          <p className="text-sm mb-2 text-center">
            Tiền thừa: <strong className="text-success">{formatCurrencyVnd(order.changeAmount)}</strong>
          </p>
        )}
        {refundedAmount > 0 && (
          <p className="text-sm mb-2 text-center text-danger">
            {t('pos.refundedBadge')}: <strong>{formatCurrencyVnd(refundedAmount)}</strong>
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" type="button" className="flex items-center gap-1.5"
            onClick={() => printReceipt(order, items, order?._cardRef)}
          >
            <Printer size={14} /> In hóa đơn
          </Button>
          {canHaveRefund && canRefund && (
            <Button
              variant="danger"
              type="button"
              disabled={!canRefundAction}
              title={!canRefundAction ? t('pos.refundedBadge') : undefined}
              className="flex items-center gap-1.5"
              onClick={() => setShowRefund(true)}
            >
              <RotateCcw size={14} /> {t('pos.refundButton')}
            </Button>
          )}
          {!canHaveRefund && isCreditOrder && (
            <span className="shrink-0 px-3 py-2 text-xs text-muted-foreground self-center">
              {t('pos.refundUnavailableCredit')}
            </span>
          )}
          <Button type="button" className="flex-1 min-w-[120px]" onClick={onClose}>
            {t('pos.newSale')}
          </Button>
        </div>

        {showRefund && (
          <RefundDialog
            order={order}
            maxRefundable={refundableRemaining}
            hasSerialItems={hasSerialItems}
            onClose={() => setShowRefund(false)}
            onSuccess={(amount) => {
              setRefundedAmount((prev) => prev + amount)
              setShowRefund(false)
            }}
          />
        )}
    </Modal>
  )
}
