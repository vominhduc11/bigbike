import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, Pencil, Plus, Search, Send } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createCoupon, fetchCoupons, mapValidationErrors, sendBulkCouponGift, updateCoupon, updateCouponStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

// Coupon status → prototype badge palette.
const STATUS_BADGE = { ACTIVE: 'bb-badge-success', INACTIVE: 'bb-badge-neutral', EXPIRED: 'bb-badge-danger', ARCHIVED: 'bb-badge-neutral' }
const CHANNEL_BADGE = { ALL: 'bb-badge-neutral', ONLINE: 'bb-badge-info', POS: 'bb-badge-warning' }
const CHANNEL_LABELS = { ALL: 'Tất cả kênh', ONLINE: 'Chỉ online', POS: 'Chỉ tại quầy' }

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }
const EMPTY_FORM = { code: '', name: '', discountType: 'FIXED', discountValue: '', minimumOrderAmount: '', maxUsage: '', expiresAt: '', channel: 'ALL' }
const EMPTY_BULK_FORM = { discountType: 'FIXED', amount: '', minimumAmount: '', validDays: '', channel: 'ALL' }

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
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM)
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

  async function handleBulkSend(e) {
    e.preventDefault()
    if (!bulkConfirm) { setBulkConfirm(true); return }
    if (!bulkForm.amount || Number(bulkForm.amount) <= 0) {
      toast.error('Vui lòng nhập giá trị giảm giá hợp lệ.')
      return
    }
    setBulkSaving(true)
    try {
      const payload = {
        discountType: bulkForm.discountType,
        amount: Number(bulkForm.amount),
        minimumAmount: bulkForm.minimumAmount !== '' ? Number(bulkForm.minimumAmount) : null,
        validDays: bulkForm.validDays !== '' ? Number(bulkForm.validDays) : null,
        usageLimit: 1,
        channel: bulkForm.channel,
      }
      const result = await sendBulkCouponGift(payload)
      toast.success(`Đã gửi mã cho ${result?.sent ?? '?'} khách hàng. Bỏ qua: ${result?.skipped ?? 0}.`)
      setBulkOpen(false)
      setBulkForm(EMPTY_BULK_FORM)
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
              <h2>Gửi mã giảm giá đến toàn bộ khách hàng</h2>
              <p className="sub">Mỗi khách hàng có tài khoản và email sẽ nhận một mã riêng. Email gửi tự động sau khi xác nhận.</p>
            </div>
          </div>
          <form onSubmit={handleBulkSend} className="bb-card-body">
            <div className="grid-2">
              <label className="form-field">
                <span>Loại giảm giá</span>
                <Select value={bulkForm.discountType} onValueChange={(val) => setBulkForm((p) => ({ ...p, discountType: val }))} disabled={bulkSaving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Giảm tiền cố định (VND)</SelectItem>
                    <SelectItem value="PERCENT">Giảm theo % đơn hàng</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="form-field">
                <span>{bulkForm.discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VND)'}</span>
                <Input
                  type="number" min="1" required
                  max={bulkForm.discountType === 'PERCENT' ? '100' : undefined}
                  step={bulkForm.discountType === 'PERCENT' ? '1' : '1000'}
                  value={bulkForm.amount}
                  onChange={(e) => setBulkForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder={bulkForm.discountType === 'PERCENT' ? 'VD: 10' : 'VD: 50000'}
                  disabled={bulkSaving}
                />
              </label>
              <label className="form-field">
                <span>Đơn hàng tối thiểu (VND) — để trống nếu không yêu cầu</span>
                <Input type="number" min="0" step="1000" value={bulkForm.minimumAmount}
                  onChange={(e) => setBulkForm((p) => ({ ...p, minimumAmount: e.target.value }))}
                  placeholder="Không giới hạn" disabled={bulkSaving} />
              </label>
              <label className="form-field">
                <span>Hiệu lực (số ngày) — để trống nếu không hết hạn</span>
                <Input type="number" min="1" max="365" value={bulkForm.validDays}
                  onChange={(e) => setBulkForm((p) => ({ ...p, validDays: e.target.value }))}
                  placeholder="VD: 30" disabled={bulkSaving} />
              </label>
              <label className="form-field">
                <span>Kênh áp dụng</span>
                <Select value={bulkForm.channel} onValueChange={(val) => setBulkForm((p) => ({ ...p, channel: val }))} disabled={bulkSaving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả kênh</SelectItem>
                    <SelectItem value="ONLINE">Chỉ online</SelectItem>
                    <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
            {bulkConfirm && (
              <Alert tone="warning" className="mt-4">
                Xác nhận gửi? Hệ thống sẽ tạo và email mã riêng cho <strong>tất cả khách hàng ACTIVE có email</strong>. Thao tác không thể hoàn tác.
              </Alert>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bb-btn bb-btn-primary" disabled={bulkSaving}>{bulkConfirm ? 'Xác nhận gửi' : 'Tiếp tục'}</button>
              <button type="button" className="bb-btn bb-btn-secondary"
                onClick={() => { setBulkOpen(false); setBulkForm(EMPTY_BULK_FORM); setBulkConfirm(false) }}
                disabled={bulkSaving}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bb-card mb-4">
          <div className="bb-card-header"><h2>{t('coupons.createTitle')}</h2></div>
          <form onSubmit={handleCreate} className="bb-card-body">
            {formError && <Alert tone="danger" size="sm" className="mb-3">{formError}</Alert>}
            <div className="grid-2">
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
        <div className="bb-card mb-4" style={{ borderColor: 'var(--admin-color-brand-red)' }}>
          <div className="bb-card-header"><h2>{t('coupons.editTitle', { code: editCoupon.code })}</h2></div>
          <form onSubmit={handleEdit} className="bb-card-body">
            {editError && <Alert tone="danger" size="sm" className="mb-3">{editError}</Alert>}
            <div className="grid-2">
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
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-muted)', pointerEvents: 'none' }} />
          <input type="search" className="bb-input" style={{ paddingLeft: 28 }} value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} placeholder={t('coupons.searchPlaceholder')} />
        </div>
        <select
          className="bb-select"
          value={query.status}
          onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}
          aria-label={t('coupons.filterStatus')}
        >
          <option value="ALL">{t('coupons.filterStatus')}</option>
          <option value="ACTIVE">{t('coupons.statusActive')}</option>
          <option value="INACTIVE">{t('coupons.statusInactive')}</option>
          <option value="EXPIRED">{t('coupons.statusExpired')}</option>
        </select>
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
                          <span className="mono" style={{ fontSize: 13, color: 'var(--admin-color-brand-red)' }}>{c.code}</span>
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
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
  )
}
