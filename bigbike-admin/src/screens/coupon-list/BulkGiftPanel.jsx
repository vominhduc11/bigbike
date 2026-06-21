import { BadgeCheck } from 'lucide-react'
import { formatCurrencyVnd, formatDateTime } from '../../lib/formatters'
import { CHANNEL_LABELS } from './constants'

// Bulk gift form: pick one ACTIVE coupon and email it to every verified-ACTIVE
// customer. All state lives in CouponListScreen and is threaded via props so
// this stays a pure presentational unit.
export function BulkGiftPanel({
  bulkCouponsLoading,
  bulkCoupons,
  bulkCoupon,
  bulkSaving,
  setBulkCoupon,
  onSend,
  onClose,
}) {
  return (
    <div className="bb-card mb-4">
      <div className="bb-card-header">
        <div>
          <h2>Gửi mã giảm giá hàng loạt</h2>
          <p className="sub">Chọn mã để gửi thông báo — hệ thống gửi email chứa code mã đó đến toàn bộ khách ACTIVE có email xác minh. Không tạo mã mới.</p>
        </div>
      </div>
      <div className="bb-card-body">
        {bulkCouponsLoading ? (
          <p className="bb-muted text-sm py-6 text-center">Đang tải danh sách mã...</p>
        ) : bulkCoupons.length === 0 ? (
          <div className="text-center py-6">
            <p className="bb-muted text-sm">Không có mã giảm giá đang hoạt động.</p>
            <p className="bb-muted text-xs mt-1">Tạo mã trước rồi mới có thể gửi hàng loạt.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bulkCoupons.map((c) => {
              const isSelected = bulkCoupon?.id === c.id
              const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : null
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={bulkSaving}
                  onClick={() => setBulkCoupon(c)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? 'border-[var(--admin-color-primary)] bg-[var(--admin-color-primary)]/5'
                      : 'border-[var(--admin-border-default)] hover:border-[var(--admin-color-primary)]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm" style={{ color: 'var(--admin-color-primary)' }}>{c.code}</span>
                        {c.name && <span className="text-sm bb-muted truncate">{c.name}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="bb-badge bb-badge-info">
                          {c.discountType === 'PERCENT' ? `-${c.discountValue}%` : `-${formatCurrencyVnd(c.discountValue)}`}
                        </span>
                        <span className="bb-badge bb-badge-neutral">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                        {c.expiresAt && <span className="text-xs bb-muted">Hết hạn: {formatDateTime(c.expiresAt)}</span>}
                        {c.minimumOrderAmount > 0 && <span className="text-xs bb-muted">Tối thiểu: {formatCurrencyVnd(c.minimumOrderAmount)}</span>}
                      </div>
                      {pct !== null && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden" style={{ flex: '0 0 80px' }}>
                            <div className="h-full bg-primary" style={{ width: pct + '%' }} />
                          </div>
                          <span className="text-xs bb-muted">{c.usageCount}/{c.maxUsage} đã dùng</span>
                        </div>
                      )}
                    </div>
                    {isSelected && <BadgeCheck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--admin-color-primary)' }} />}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {bulkCoupon && (
          <div className="mt-4 p-3 rounded-md text-sm" style={{ background: 'var(--admin-surface-muted)', border: '1px solid var(--admin-border-default)' }}>
            Sẽ gửi email thông báo mã <span className="font-mono font-semibold" style={{ color: 'var(--admin-color-primary)' }}>{bulkCoupon.code}</span> đến <strong>toàn bộ khách ACTIVE có email xác minh</strong>. Không tạo mã mới.
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            disabled={!bulkCoupon || bulkSaving}
            onClick={onSend}
          >
            {bulkSaving ? 'Đang gửi...' : 'Gửi mã hàng loạt'}
          </button>
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={onClose}
            disabled={bulkSaving}
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  )
}
