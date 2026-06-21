import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { toast } from 'sonner'
import { Plus, Send } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { MobileCardList } from '../components/layout/MobileCardList'
import { createCoupon, deleteCoupon, fetchCoupons, mapValidationErrors, sendBulkCouponGift, updateCoupon, updateCouponStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { CustomerPickerModal } from '../components/CustomerPickerModal'
import { useDebounce } from '../lib/useDebounce'
import { useAdminList } from '../lib/useAdminList'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { INITIAL_QUERY, EMPTY_FORM, toEndOfDayInstant } from './coupon-list/constants'
import { BulkGiftPanel } from './coupon-list/BulkGiftPanel'
import { CouponRow } from './coupon-list/CouponRow'
import { CouponMobileCard } from './coupon-list/CouponMobileCard'

export function CouponListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const queryClient = useQueryClient()
  // Danh sách mã giảm giá qua react-query (cache + dedupe + giữ trang cũ khi đổi filter).
  const state = useAdminList(['coupons', query], () => fetchCoupons(query))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formFieldErrors, setFormFieldErrors] = useState({})
  const [formSaving, setFormSaving] = useState(false)
  const [editCoupon, setEditCoupon] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCoupon, setBulkCoupon] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  // Danh sách mã ACTIVE cho panel gửi hàng loạt — chỉ tải khi panel mở.
  const { data: bulkData, isLoading: bulkCouponsLoading } = useQuery({
    queryKey: ['coupons', 'active-for-bulk'],
    queryFn: () => fetchCoupons({ status: 'ACTIVE', page: 1, pageSize: 100, search: '' }),
    enabled: bulkOpen,
  })
  const bulkCoupons = bulkData?.items ?? []

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const handleToggleStatus = useCallback(async (coupon) => {
    const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setActionError('')
    try {
      await updateCouponStatus(coupon.id, newStatus)
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
    } catch (e) {
      setActionError(e.message || t('common.error'))
    }
  }, [t, queryClient])

  const handleDelete = useCallback(async (coupon) => {
    const confirmed = await showConfirm(
      `Xóa vĩnh viễn mã "${coupon.code}"?\nThao tác không thể hoàn tác.\nNếu mã đã từng được dùng trong đơn hàng thì không xóa được — hãy dùng nút "Ngưng" thay vì xóa.`,
      'Xóa mã giảm giá',
    )
    if (!confirmed) return
    try {
      await deleteCoupon(coupon.id)
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      toast.success(`Đã xóa mã ${coupon.code}.`)
    } catch (e) {
      const msg = e?.status === 409
        ? `Không thể xóa mã "${coupon.code}" vì đã được dùng trong đơn hàng. Hãy dùng nút "Ngưng" để ngừng áp dụng mã, thay vì xóa (giữ lịch sử đơn hàng).`
        : (e.message || t('common.error'))
      toast.error(msg)
    }
  }, [t, queryClient])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.code.trim()) { setFormError(t('coupons.formCode') + ' ' + t('common.required').toLowerCase()); return }
    if (!form.name.trim()) { setFormError(t('coupons.formName') + ' ' + t('common.required').toLowerCase()); return }
    setFormSaving(true)
    setFormError('')
    setFormFieldErrors({})
    try {
      const payload = {
        code: form.code,
        name: form.name.trim(),
        discountType: form.discountType,
        amount: Number(form.discountValue),
        minimumAmount: Number(form.minimumOrderAmount) || 0,
        channel: form.channel || 'ALL',
      }
      if (form.maxUsage) payload.usageLimit = Number(form.maxUsage)
      if (form.expiresAt) payload.expiresAt = toEndOfDayInstant(form.expiresAt)
      await createCoupon(payload)
      setShowForm(false)
      setForm(EMPTY_FORM)
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
    } catch (e) {
      const fieldErrs = mapValidationErrors(e)
      if (Object.keys(fieldErrs).length > 0) {
        setFormFieldErrors(fieldErrs)
      } else {
        setFormError(e.message || t('common.error'))
      }
    } finally {
      setFormSaving(false)
    }
  }

  function openEdit(coupon) {
    setEditCoupon(coupon)
    setEditForm({
      discountType: coupon.discountType || 'FIXED',
      discountValue: String(coupon.discountValue ?? ''),
      minimumOrderAmount: String(coupon.minimumOrderAmount ?? ''),
      maxUsage: String(coupon.maxUsage ?? ''),
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '',
      channel: coupon.channel || 'ALL',
    })
    setEditError('')
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const payload = {
        discountType: editForm.discountType,
        amount: Number(editForm.discountValue),
        minimumAmount: Number(editForm.minimumOrderAmount) || 0,
        channel: editForm.channel || 'ALL',
      }
      if (editForm.maxUsage) payload.usageLimit = Number(editForm.maxUsage)
      if (editForm.expiresAt) payload.expiresAt = toEndOfDayInstant(editForm.expiresAt)
      await updateCoupon(editCoupon.id, payload)
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      setEditCoupon(null)
    } catch (e) {
      setEditError(e.message || t('common.error'))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleBulkSend() {
    if (!bulkConfirm) { setBulkConfirm(true); return }
    if (!bulkCoupon) return
    setBulkSaving(true)
    try {
      const result = await sendBulkCouponGift({ couponId: bulkCoupon.id })
      toast.success(`Đã gửi mã cho ${result?.sent ?? '?'} khách hàng. Bỏ qua: ${result?.skipped ?? 0}.`)
      closeBulkPanel()
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
    } catch (err) {
      toast.error(err.message || 'Gửi mã thất bại.')
      setBulkConfirm(false)
    } finally {
      setBulkSaving(false)
    }
  }

  // Close the bulk-send panel and clear its selection so the next open starts
  // fresh. Centralized here so reset lives with the close action, not in an effect.
  function closeBulkPanel() {
    setBulkOpen(false)
    setBulkCoupon(null)
    setBulkConfirm(false)
  }

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  const items = state.items || []

  return (
    <>
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('coupons.eyebrow')}</p>
          <h1>{t('coupons.title')}</h1>
          <p className="bb-muted">{t('coupons.description')}</p>
        </div>
        {canUpdate && (
          <div className="bb-screen-actions">
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              onClick={() => { setPickerOpen(true); closeBulkPanel(); setShowForm(false) }}
            >
              <Send size={14} />Gửi mã theo nhóm
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              onClick={() => { if (bulkOpen) { closeBulkPanel() } else { setBulkOpen(true); setBulkConfirm(false) } setShowForm(false) }}
            >
              <Send size={14} />{bulkOpen ? t('common.cancel') : 'Gửi mã hàng loạt'}
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-primary"
              onClick={() => { setShowForm(!showForm); closeBulkPanel() }}
            >
              <Plus size={14} />{showForm ? t('common.cancel') : t('coupons.createBtn')}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {/* Bulk gift form */}
      {bulkOpen && (
        <BulkGiftPanel
          bulkCouponsLoading={bulkCouponsLoading}
          bulkCoupons={bulkCoupons}
          bulkCoupon={bulkCoupon}
          bulkSaving={bulkSaving}
          bulkConfirm={bulkConfirm}
          setBulkCoupon={setBulkCoupon}
          setBulkConfirm={setBulkConfirm}
          onSend={handleBulkSend}
          onClose={() => closeBulkPanel()}
        />
      )}

      {/* Create form */}
      {showForm && (
        <div className="bb-card mb-4">
          <div className="bb-card-header"><h2>{t('coupons.createTitle')}</h2></div>
          <form onSubmit={handleCreate} className="bb-card-body">
            {formError && <Alert tone="danger" size="sm" className="mb-3">{formError}</Alert>}
            <div className="bb-grid-2">
              <label className="form-field">
                <span>{t('coupons.formCode')}</span>
                <Input required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
                {formFieldErrors.code && <span className="hint text-danger">{formFieldErrors.code}</span>}
              </label>
              <label className="form-field">
                <span>{t('coupons.formName')}</span>
                <Input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                {formFieldErrors.name && <span className="hint text-danger">{formFieldErrors.name}</span>}
              </label>
              <label className="form-field">
                <span>{t('coupons.formDiscountType')}</span>
                <Select value={form.discountType} onValueChange={(val) => setForm((p) => ({ ...p, discountType: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">{t('coupons.formFixed')}</SelectItem>
                    <SelectItem value="PERCENT">{t('coupons.formPercent')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="form-field">
                <span>{t('coupons.formValue')}</span>
                <Input type="number" min="0" required value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>{t('coupons.formMinOrder')}</span>
                <Input type="number" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>{t('coupons.formMaxUses')}</span>
                <Input type="number" min="0" value={form.maxUsage} onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>{t('coupons.formExpires')}</span>
                <Input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Kênh áp dụng</span>
                <Select value={form.channel} onValueChange={(val) => setForm((p) => ({ ...p, channel: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả kênh</SelectItem>
                    <SelectItem value="ONLINE">Chỉ online</SelectItem>
                    <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="submit" className="bb-btn bb-btn-primary" disabled={formSaving}>{formSaving ? t('common.saving') : t('coupons.createBtn')}</button>
              <button type="button" className="bb-btn bb-btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(''); setFormFieldErrors({}) }}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editCoupon && (
        <div className="bb-card mb-4" style={{ borderColor: 'var(--admin-color-primary)' }}>
          <div className="bb-card-header"><h2>{t('coupons.editTitle', { code: editCoupon.code })}</h2></div>
          <form onSubmit={handleEdit} className="bb-card-body">
            {editError && <Alert tone="danger" size="sm" className="mb-3">{editError}</Alert>}
            <div className="bb-grid-2">
              <label className="form-field">
                <span>{t('coupons.formDiscountType')}</span>
                <Select value={editForm.discountType} onValueChange={(val) => setEditForm((p) => ({ ...p, discountType: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">{t('coupons.formFixed')}</SelectItem>
                    <SelectItem value="PERCENT">{t('coupons.formPercent')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="form-field">
                <span>{t('coupons.formValue')}</span>
                <Input type="number" min="0" required value={editForm.discountValue} onChange={(e) => setEditForm((p) => ({ ...p, discountValue: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>{t('coupons.formMinOrder')}</span>
                <Input type="number" min="0" value={editForm.minimumOrderAmount} onChange={(e) => setEditForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>{t('coupons.formMaxUses')}</span>
                <Input type="number" min="0" value={editForm.maxUsage} onChange={(e) => setEditForm((p) => ({ ...p, maxUsage: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>{t('coupons.formExpires')}</span>
                <Input type="date" value={editForm.expiresAt} onChange={(e) => setEditForm((p) => ({ ...p, expiresAt: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Kênh áp dụng</span>
                <Select value={editForm.channel || 'ALL'} onValueChange={(val) => setEditForm((p) => ({ ...p, channel: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả kênh</SelectItem>
                    <SelectItem value="ONLINE">Chỉ online</SelectItem>
                    <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bb-btn bb-btn-primary" disabled={editSaving}>{editSaving ? t('common.saving') : t('coupons.saveBtn')}</button>
              <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setEditCoupon(null)}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Filter bar */}
      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('coupons.searchPlaceholder')}
        />
        <FilterSelect
          value={query.status}
          onValueChange={(v) => updateQuery({ status: v }, { resetPage: true })}
          ariaLabel={t('coupons.filterStatus')}
          options={[
            { value: 'ALL', label: t('coupons.filterStatus') },
            { value: 'ACTIVE', label: t('coupons.statusActive') },
            { value: 'INACTIVE', label: t('coupons.statusInactive') },
            { value: 'EXPIRED', label: t('coupons.statusExpired') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('coupons.error')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => queryClient.invalidateQueries({ queryKey: ['coupons'] })} />
      )}
      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral" title={t('coupons.empty')} description={t('coupons.emptyDesc')}
          actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="hide-on-mobile">
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>{t('coupons.colCode')}</th>
                    <th>{t('coupons.colName')}</th>
                    <th>{t('coupons.colDiscount')}</th>
                    <th className="num">{t('coupons.colUsed')}</th>
                    <th>Tỉ lệ dùng</th>
                    <th>Kênh</th>
                    <th>{t('coupons.colExpires')}</th>
                    <th>{t('coupons.colStatus')}</th>
                    {canUpdate && <th />}
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(6)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={canUpdate ? 9 : 8}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((c) => (
                    <CouponRow
                      key={c.id}
                      c={c}
                      canUpdate={canUpdate}
                      onEdit={openEdit}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            <MobileCardList>
              {items.map((c) => (
                <CouponMobileCard
                  key={c.id}
                  c={c}
                  canUpdate={canUpdate}
                  onEdit={openEdit}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              ))}
            </MobileCardList>
          </div>
          {state.status === 'success' && state.pagination && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </div>
      )}
    </div>

    <CustomerPickerModal
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
    />
    </>
  )
}
