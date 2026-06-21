import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fetchCoupons, fetchCustomers, sendTargetedCouponGift } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BadgeCheck } from 'lucide-react'

const CHANNEL_LABELS = { ALL: 'Tất cả kênh', ONLINE: 'Chỉ online', POS: 'Chỉ tại quầy' }
const PAGE_SIZE = 10


export function CustomerPickerModal({ open, onClose }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState({ items: [], totalItems: 0, totalPages: 1, loading: false })
  const [selected, setSelected] = useState(new Set())
  const [step, setStep] = useState('pick') // 'pick' | 'coupon'
  const [coupons, setCoupons] = useState([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState(null)
  const [sending, setSending] = useState(false)
  const searchTimeout = useRef(null)

  async function loadCustomers(p, q) {
    setCustomers((prev) => ({ ...prev, loading: true }))
    try {
      const result = await fetchCustomers({ page: p, pageSize: PAGE_SIZE, search: q, status: 'ACTIVE', emailVerified: true })
      setCustomers({
        items: result.items ?? [],
        totalItems: result.pagination?.totalItems ?? 0,
        totalPages: result.pagination?.totalPages ?? 1,
        loading: false,
      })
    } catch {
      setCustomers((prev) => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch('')
    setPage(1)
    setSelected(new Set())
    setSelectedCoupon(null)
    setStep('pick')
  }, [open])

  useEffect(() => {
    if (!open) return
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      loadCustomers(page, search)
    }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [open, search, page])

  useEffect(() => {
    if (step !== 'coupon') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCouponsLoading(true)
    fetchCoupons({ status: 'ACTIVE', page: 1, pageSize: 100, search: '' })
      .then((r) => setCoupons(r.items ?? []))
      .catch(() => setCoupons([]))
      .finally(() => setCouponsLoading(false))
  }, [step])

  function toggleCustomer(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const pageIds = customers.items.map((c) => c.id)
    const allSelected = pageIds.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  async function handleSend() {
    if (!selectedCoupon) return
    setSending(true)
    try {
      const result = await sendTargetedCouponGift({
        couponId: selectedCoupon.id,
        customerIds: [...selected],
      })
      toast.success(`Đã gửi ${result.sent} mã. Bỏ qua: ${result.skipped}.`)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Gửi mã thất bại.')
    } finally {
      setSending(false)
    }
  }

  const pageIds = customers.items.map((c) => c.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'pick'
              ? 'Gửi mã theo nhóm — Chọn khách hàng'
              : `Chọn mã giảm giá — ${selected.size} khách được chọn`}
          </DialogTitle>
        </DialogHeader>

        {step === 'pick' && (
          <>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Tìm theo tên, email, số điện thoại..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="flex-1"
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="bb-table-wrap">
                {customers.loading ? (
                  <p className="bb-muted text-sm p-4 text-center">Đang tải...</p>
                ) : customers.items.length === 0 ? (
                  <p className="bb-muted text-sm p-4 text-center">Không có khách hàng phù hợp.</p>
                ) : (
                  <table className="bb-table">
                    <thead>
                      <tr>
                        <th className="col-check">
                          <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                        </th>
                        <th>Tên</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.items.map((c) => (
                        <tr
                          key={c.id}
                          className={`cursor-pointer${selected.has(c.id) ? ' selected' : ''}`}
                          onClick={() => toggleCustomer(c.id)}
                        >
                          <td className="col-check" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleCustomer(c.id)} />
                          </td>
                          <td className="font-medium">{c.displayName || c.fullName || '—'}</td>
                          <td className="bb-muted">{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-sm bb-muted">
              <span>Tổng: {customers.totalItems} khách — Đã chọn: {selected.size}</span>
              <div className="flex gap-1 items-center">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
                <span>{page} / {customers.totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= customers.totalPages} onClick={() => setPage((p) => p + 1)}>›</Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Hủy</Button>
              <Button disabled={selected.size === 0} onClick={() => setStep('coupon')}>
                Tiếp theo ({selected.size})
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'coupon' && (
          <>
            <p className="text-sm bb-muted">
              Hệ thống gửi email chứa mã đã chọn đến từng khách. Không tạo mã mới.
            </p>

            <div className="flex-1 overflow-y-auto min-h-0 mt-3">
              {couponsLoading ? (
                <p className="bb-muted text-sm p-4 text-center">Đang tải danh sách mã...</p>
              ) : coupons.length === 0 ? (
                <div className="text-center py-8">
                  <p className="bb-muted text-sm">Không có mã giảm giá đang hoạt động.</p>
                  <p className="bb-muted text-xs mt-1">Tạo mã trước rồi quay lại đây.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {coupons.map((c) => {
                    const isSelected = selectedCoupon?.id === c.id
                    const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : null
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={sending}
                        onClick={() => setSelectedCoupon(c)}
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
                                <div className="stock-bar" style={{ flex: '0 0 80px' }}><div style={{ width: pct + '%' }} /></div>
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
            </div>

            {selectedCoupon && (
              <div className="mt-3 p-3 rounded-md text-sm" style={{ background: 'var(--admin-surface-muted)', border: '1px solid var(--admin-border-default)' }}>
                Sẽ tạo <strong>{selected.size} mã</strong> theo thiết lập của{' '}
                <span className="font-mono font-semibold" style={{ color: 'var(--admin-color-primary)' }}>{selectedCoupon.code}</span>{' '}
                và gửi email cho từng khách.
              </div>
            )}

            <DialogFooter className="mt-3">
              <Button type="button" variant="outline" onClick={() => setStep('pick')} disabled={sending}>Quay lại</Button>
              <Button onClick={handleSend} disabled={!selectedCoupon || sending}>
                {sending ? 'Đang gửi...' : `Gửi thông báo ${selected.size} khách`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
