import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { toast } from 'sonner'
import { BadgeCheck, Copy, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { createCoupon, deleteCoupon, fetchCoupons, mapValidationErrors, sendBulkCouponGift, updateCoupon, updateCouponStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { CustomerPickerModal } from '../components/CustomerPickerModal'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

// Coupon status → prototype badge palette.
const STATUS_BADGE = { ACTIVE: 'bb-badge-success', INACTIVE: 'bb-badge-neutral', EXPIRED: 'bb-badge-danger', ARCHIVED: 'bb-badge-neutral' }
const CHANNEL_BADGE = { ALL: 'bb-badge-neutral', ONLINE: 'bb-badge-info', POS: 'bb-badge-warning' }
const CHANNEL_LABELS = { ALL: 'Tất cả kênh', ONLINE: 'Chỉ online', POS: 'Chỉ tại quầy' }

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }
const EMPTY_FORM = { code: '', name: '', discountType: 'FIXED', discountValue: '', minimumOrderAmount: '', maxUsage: '', expiresAt: '', channel: 'ALL' }

// Convert "YYYY-MM-DD" date picker value to end-of-day Vietnam time ISO instant.
function toEndOfDayInstant(dateStr) {
  if (!dateStr) return undefined
  return dateStr + 'T23:59:59+07:00'
}

function CouponStatusBadge({ value }) {
  const { t } = useTranslation()
  const labels = {
    ACTIVE: t('coupons.statusActive'),
    INACTIVE: t('coupons.statusInactive'),
    EXPIRED: t('coupons.statusExpired'),
    ARCHIVED: t('coupons.statusArchived'),
  }
  return (
    <span className={`bb-badge ${STATUS_BADGE[value] || 'bb-badge-neutral'}`}>
      {labels[value] ?? value}
    </span>
  )
}

function ChannelBadge({ value }) {
  return <span className={`bb-badge ${CHANNEL_BADGE[value] || 'bb-badge-neutral'}`}>{CHANNEL_LABELS[value] ?? value}</span>
}

export function CouponListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
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
  const [bulkCoupons, setBulkCoupons] = useState([])
  const [bulkCouponsLoading, setBulkCouponsLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  useEffect(() => {
    let active = true
    fetchCoupons(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    if (!bulkOpen) { setBulkCoupon(null); setBulkCoupons([]); setBulkConfirm(false); return }
    setBulkCouponsLoading(true)
    fetchCoupons({ status: 'ACTIVE', page: 1, pageSize: 100, search: '' })
      .then((r) => setBulkCoupons(r.items ?? []))
      .catch(() => setBulkCoupons([]))
      .finally(() => setBulkCouponsLoading(false))
  }, [bulkOpen])

  const handleToggleStatus = useCallback(async (coupon) => {
    const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setActionError('')
    try {
      const r = await updateCouponStatus(coupon.id, newStatus)
      setState((p) => ({ ...p, items: p.items.map((c) => c.id === coupon.id ? r.item : c) }))
    } catch (e) {
      setActionError(e.message || t('common.error'))
    }
  }, [t])

  const handleDelete = useCallback(async (coupon) => {
    const confirmed = await showConfirm(
      `Xóa vĩnh viễn mã "${coupon.code}"?\nThao tác không thể hoàn tác.`,
      'Xóa mã giảm giá',
    )
    if (!confirmed) return
    try {
      await deleteCoupon(coupon.id)
      setState((p) => ({ ...p, items: p.items.filter((c) => c.id !== coupon.id) }))
      toast.success(`Đã xóa mã ${coupon.code}.`)
    } catch (e) {
      toast.error(e.message || t('common.error'))
    }
  }, [t])

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
      setQuery((p) => ({ ...p }))
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
      const r = await updateCoupon(editCoupon.id, payload)
      setState((p) => ({ ...p, items: p.items.map((c) => c.id === editCoupon.id ? r.item : c) }))
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
      setBulkOpen(false)
      setBulkCoupon(null)
      setBulkCoupons([])
      setBulkConfirm(false)
      setQuery((p) => ({ ...p }))
    } catch (err) {
      toast.error(err.message || 'Gửi mã thất bại.')
      setBulkConfirm(false)
    } finally {
      setBulkSaving(false)
    }
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
              onClick={() => { setPickerOpen(true); setBulkOpen(false); setShowForm(false) }}
            >
              <Send size={14} />Gửi mã theo nhóm
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              onClick={() => { setBulkOpen(!bulkOpen); setBulkConfirm(false); setShowForm(false) }}
            >
              <Send size={14} />{bulkOpen ? t('common.cancel') : 'Gửi mã hàng loạt'}
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-primary"
              onClick={() => { setShowForm(!showForm); setBulkOpen(false) }}
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
                      onClick={() => { setBulkCoupon(c); setBulkConfirm(false) }}
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

            {bulkCoupon && (
              <div className="mt-4 p-3 rounded-md text-sm" style={{ background: 'var(--admin-surface-muted)', border: '1px solid var(--admin-border-default)' }}>
                Sẽ gửi email thông báo mã <span className="font-mono font-semibold" style={{ color: 'var(--admin-color-primary)' }}>{bulkCoupon.code}</span> đến <strong>toàn bộ khách ACTIVE có email xác minh</strong>. Không tạo mã mới.
              </div>
            )}

            {bulkConfirm && (
              <Alert tone="warning" className="mt-3">
                Xác nhận gửi? Thao tác sẽ tạo hàng loạt mã và email — <strong>không thể hoàn tác</strong>.
              </Alert>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="bb-btn bb-btn-primary"
                disabled={!bulkCoupon || bulkSaving}
                onClick={handleBulkSend}
              >
                {bulkSaving ? 'Đang gửi...' : bulkConfirm ? 'Xác nhận gửi' : 'Tiếp tục'}
              </button>
              <button
                type="button"
                className="bb-btn bb-btn-secondary"
                onClick={() => setBulkOpen(false)}
                disabled={bulkSaving}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
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
          actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />
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
                  {items.map((c) => {
                    const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : 0
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-primary)' }}>{c.code}</span>
                        </td>
                        <td>{c.name || '—'}</td>
                        <td>
                          <span className="bb-badge bb-badge-info">
                            {c.discountType === 'PERCENT' ? `-${c.discountValue}%` : `-${formatCurrencyVnd(c.discountValue)}`}
                          </span>
                        </td>
                        <td className="num">{c.usageCount}{c.maxUsage ? ` / ${c.maxUsage}` : ''}</td>
                        <td style={{ minWidth: 140 }}>
                          {c.maxUsage ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="stock-bar"><div style={{ width: pct + '%' }} /></div>
                              <span className="bb-muted" style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <span className="bb-muted" style={{ fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td><ChannelBadge value={c.channel || 'ALL'} /></td>
                        <td className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(c.expiresAt)}</td>
                        <td><CouponStatusBadge value={c.status} /></td>
                        {canUpdate && (
                          <td className="col-actions">
                            <button type="button" className="bb-icon-btn" title={t('common.edit')} onClick={() => openEdit(c)}>
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="bb-icon-btn"
                              title={c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
                              onClick={() => handleToggleStatus(c)}
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              type="button"
                              className="bb-icon-btn"
                              title={t('common.delete')}
                              onClick={() => handleDelete(c)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
            <MobileCardList>
              {items.map((c) => {
                const pct = c.maxUsage ? Math.min(100, (c.usageCount / c.maxUsage) * 100) : 0
                return (
                  <MobileCard
                    key={c.id}
                    title={<span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-primary)' }}>{c.code}</span>}
                    subtitle={c.name || '—'}
                    status={<CouponStatusBadge value={c.status} />}
                    meta={[
                      {
                        label: t('coupons.colDiscount'),
                        value: (
                          <span className="bb-badge bb-badge-info">
                            {c.discountType === 'PERCENT' ? `-${c.discountValue}%` : `-${formatCurrencyVnd(c.discountValue)}`}
                          </span>
                        ),
                      },
                      { label: t('coupons.colUsed'), value: `${c.usageCount}${c.maxUsage ? ` / ${c.maxUsage}` : ''}` },
                      {
                        label: 'Tỉ lệ dùng',
                        value: c.maxUsage ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="stock-bar"><div style={{ width: pct + '%' }} /></div>
                            <span className="bb-muted" style={{ fontSize: 12 }}>{pct.toFixed(0)}%</span>
                          </div>
                        ) : '—',
                      },
                      { label: 'Kênh', value: <ChannelBadge value={c.channel || 'ALL'} /> },
                      { label: t('coupons.colExpires'), value: formatDateTime(c.expiresAt) },
                    ]}
                    actions={canUpdate ? (
                      <>
                        <button type="button" className="bb-icon-btn" title={t('common.edit')} onClick={() => openEdit(c)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="bb-icon-btn"
                          title={c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
                          onClick={() => handleToggleStatus(c)}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="bb-icon-btn"
                          title={t('common.delete')}
                          onClick={() => handleDelete(c)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : undefined}
                  />
                )
              })}
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
