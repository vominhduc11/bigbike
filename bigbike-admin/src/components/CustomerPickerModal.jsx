import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fetchCustomers, sendTargetedCouponGift } from '../lib/adminApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const EMPTY_COUPON_FORM = {
  discountType: 'FIXED',
  amount: '',
  minimumAmount: '',
  validDays: '',
  channel: 'ALL',
}

const PAGE_SIZE = 10

export function CustomerPickerModal({ open, onClose }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState({ items: [], totalItems: 0, totalPages: 1, loading: false })
  const [selected, setSelected] = useState(new Set())
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM)
  const [step, setStep] = useState('pick') // 'pick' | 'configure'
  const [sending, setSending] = useState(false)
  const searchTimeout = useRef(null)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setPage(1)
    setSelected(new Set())
    setCouponForm(EMPTY_COUPON_FORM)
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

  async function loadCustomers(p, q) {
    setCustomers((prev) => ({ ...prev, loading: true }))
    try {
      const result = await fetchCustomers({ page: p, pageSize: PAGE_SIZE, search: q, status: 'ACTIVE', emailVerified: true })
      setCustomers({ items: result.items ?? [], totalItems: result.totalItems ?? 0, totalPages: result.totalPages ?? 1, loading: false })
    } catch {
      setCustomers((prev) => ({ ...prev, loading: false }))
    }
  }

  function handleSearchChange(e) {
    setSearch(e.target.value)
    setPage(1)
  }

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

  async function handleSend(e) {
    e.preventDefault()
    if (!couponForm.amount || Number(couponForm.amount) <= 0) {
      toast.error('Vui lòng nhập giá trị giảm giá hợp lệ.')
      return
    }
    setSending(true)
    try {
      const result = await sendTargetedCouponGift({
        customerIds: [...selected],
        discountType: couponForm.discountType,
        amount: Number(couponForm.amount),
        minimumAmount: couponForm.minimumAmount !== '' ? Number(couponForm.minimumAmount) : null,
        validDays: couponForm.validDays !== '' ? Number(couponForm.validDays) : null,
        usageLimit: 1,
        channel: couponForm.channel,
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
            {step === 'pick' ? 'Chọn khách hàng nhận mã giảm giá' : `Cấu hình mã — ${selected.size} khách được chọn`}
          </DialogTitle>
        </DialogHeader>

        {step === 'pick' && (
          <>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Tìm theo tên, email, số điện thoại..."
                value={search}
                onChange={handleSearchChange}
                className="flex-1"
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-border rounded-md min-h-0">
              {customers.loading ? (
                <p className="text-muted-foreground text-sm p-4 text-center">Đang tải...</p>
              ) : customers.items.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4 text-center">Không có khách hàng phù hợp.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted sticky top-0">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tên</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.items.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-t border-border cursor-pointer hover:bg-surface-muted/50 ${selected.has(c.id) ? 'bg-surface-selected/30' : ''}`}
                        onClick={() => toggleCustomer(c.id)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleCustomer(c.id)} />
                        </td>
                        <td className="px-3 py-2 font-medium">{c.displayName || c.fullName || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
              <span>Tổng: {customers.totalItems} khách — Đã chọn: {selected.size}</span>
              <div className="flex gap-1 items-center">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
                <span>{page} / {customers.totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= customers.totalPages} onClick={() => setPage((p) => p + 1)}>›</Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Hủy</Button>
              <Button disabled={selected.size === 0} onClick={() => setStep('configure')}>
                Tiếp theo ({selected.size})
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'configure' && (
          <form onSubmit={handleSend} className="flex flex-col gap-3 overflow-y-auto">
            <label>
              Loại giảm giá
              <Select
                value={couponForm.discountType}
                onValueChange={(val) => setCouponForm((p) => ({ ...p, discountType: val }))}
                disabled={sending}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Giảm tiền cố định (VND)</SelectItem>
                  <SelectItem value="PERCENT">Giảm theo % đơn hàng</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label>
              {couponForm.discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VND)'}
              <Input
                type="number"
                min="1"
                max={couponForm.discountType === 'PERCENT' ? '100' : undefined}
                step={couponForm.discountType === 'PERCENT' ? '1' : '1000'}
                value={couponForm.amount}
                onChange={(e) => setCouponForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder={couponForm.discountType === 'PERCENT' ? 'VD: 10' : 'VD: 50000'}
                disabled={sending}
                required
              />
            </label>

            <label>
              Đơn hàng tối thiểu (VND) — để trống nếu không yêu cầu
              <Input
                type="number"
                min="0"
                step="1000"
                value={couponForm.minimumAmount}
                onChange={(e) => setCouponForm((p) => ({ ...p, minimumAmount: e.target.value }))}
                placeholder="Không giới hạn"
                disabled={sending}
              />
            </label>

            <label>
              Hiệu lực (số ngày) — để trống nếu không hết hạn
              <Input
                type="number"
                min="1"
                max="365"
                value={couponForm.validDays}
                onChange={(e) => setCouponForm((p) => ({ ...p, validDays: e.target.value }))}
                placeholder="VD: 30"
                disabled={sending}
              />
            </label>

            <label>
              Kênh áp dụng
              <Select
                value={couponForm.channel}
                onValueChange={(val) => setCouponForm((p) => ({ ...p, channel: val }))}
                disabled={sending}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả kênh</SelectItem>
                  <SelectItem value="ONLINE">Chỉ online</SelectItem>
                  <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setStep('pick')} disabled={sending}>Quay lại</Button>
              <Button type="submit" disabled={sending}>
                {sending ? 'Đang gửi...' : `Tạo & gửi ${selected.size} mã`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
