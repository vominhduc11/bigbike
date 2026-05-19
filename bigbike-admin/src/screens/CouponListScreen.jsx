import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createCoupon, fetchCoupons, mapValidationErrors, sendBulkCouponGift, updateCoupon, updateCouponStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const STATUS_TONES = { ACTIVE: 'success', INACTIVE: 'warning', EXPIRED: 'muted', ARCHIVED: 'muted' }
function CouponStatusBadge({ value }) {
  const { t } = useTranslation()
  const labels = {
    ACTIVE: t('coupons.statusActive'),
    INACTIVE: t('coupons.statusInactive'),
    EXPIRED: t('coupons.statusExpired'),
    ARCHIVED: t('coupons.statusArchived'),
  }
  const variant = STATUS_TONES[value] || 'muted'
  return <Badge variant={variant}>{labels[value] ?? value}</Badge>
}

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }
const EMPTY_FORM = { code: '', name: '', discountType: 'FIXED', discountValue: '', minimumOrderAmount: '', maxUsage: '', expiresAt: '', channel: 'ALL' }

const CHANNEL_LABELS = { ALL: 'Tất cả kênh', ONLINE: 'Chỉ online', POS: 'Chỉ tại quầy' }
function ChannelBadge({ value }) {
  const tones = { ALL: 'muted', ONLINE: 'info', POS: 'warning' }
  const variant = tones[value] || 'muted'
  return <Badge variant={variant}>{CHANNEL_LABELS[value] ?? value}</Badge>
}

// Convert "YYYY-MM-DD" date picker value to end-of-day Vietnam time ISO instant
function toEndOfDayInstant(dateStr) {
  if (!dateStr) return undefined
  return dateStr + 'T23:59:59+07:00'
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

  const EMPTY_BULK_FORM = { discountType: 'FIXED', amount: '', minimumAmount: '', validDays: '', channel: 'ALL' }
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  useEffect(() => {
    let active = true
    fetchCoupons(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
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

  const columns = useMemo(() => [
    { key: 'code', label: t('coupons.colCode'), render: (c) => <code className="font-bold">{c.code}</code> },
    {
      key: 'discount', label: t('coupons.colDiscount'),
      render: (c) => c.discountType === 'PERCENT' ? `${c.discountValue}%` : formatCurrencyVnd(c.discountValue),
    },
    { key: 'name', label: t('coupons.colName'), render: (c) => c.name || '—' },
    { key: 'minimumOrderAmount', label: t('coupons.colMinOrder'), render: (c) => c.minimumOrderAmount ? formatCurrencyVnd(c.minimumOrderAmount) : '—' },
    { key: 'usage', label: t('coupons.colUsed'), render: (c) => `${c.usageCount}${c.maxUsage ? ` / ${c.maxUsage}` : ''}` },
    { key: 'channel', label: 'Kênh', render: (c) => <ChannelBadge value={c.channel || 'ALL'} /> },
    { key: 'status', label: t('coupons.colStatus'), render: (c) => <CouponStatusBadge value={c.status} /> },
    { key: 'expiresAt', label: t('coupons.colExpires'), render: (c) => formatDateTime(c.expiresAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="outline" size="sm" onClick={() => openEdit(c)}>{t('common.edit')}</Button>
          <Button variant="outline" size="sm" onClick={() => handleToggleStatus(c)}>
            {c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
          </Button>
        </div>
      ),
    } : null,
  ].filter(Boolean), [canUpdate, handleToggleStatus, t])

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

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('coupons.eyebrow')}</p>
          <h1>{t('coupons.title')}</h1>
          <p>{t('coupons.description')}</p>
        </div>
        {canUpdate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setBulkOpen(!bulkOpen); setBulkConfirm(false); setShowForm(false) }}>
              {bulkOpen ? t('common.cancel') : 'Gửi mã hàng loạt'}
            </Button>
            <Button onClick={() => { setShowForm(!showForm); setBulkOpen(false) }}>
              {showForm ? t('common.cancel') : t('coupons.createBtn')}
            </Button>
          </div>
        )}
      </header>

      {actionError && (
        <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {bulkOpen && (
        <form onSubmit={handleBulkSend} className="mb-6 rounded-sm border border-border bg-surface p-6">
          <h3 className="mb-1">Gửi mã giảm giá đến toàn bộ khách hàng</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Mỗi khách hàng có tài khoản và email sẽ nhận một mã riêng. Email gửi tự động sau khi xác nhận.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label>Loại giảm giá
              <Select value={bulkForm.discountType} onValueChange={(val) => setBulkForm((p) => ({ ...p, discountType: val }))} disabled={bulkSaving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Giảm tiền cố định (VND)</SelectItem>
                  <SelectItem value="PERCENT">Giảm theo % đơn hàng</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              {bulkForm.discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VND)'}
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
            <label>Đơn hàng tối thiểu (VND) — để trống nếu không yêu cầu
              <Input type="number" min="0" step="1000" value={bulkForm.minimumAmount}
                onChange={(e) => setBulkForm((p) => ({ ...p, minimumAmount: e.target.value }))}
                placeholder="Không giới hạn" disabled={bulkSaving} />
            </label>
            <label>Hiệu lực (số ngày) — để trống nếu không hết hạn
              <Input type="number" min="1" max="365" value={bulkForm.validDays}
                onChange={(e) => setBulkForm((p) => ({ ...p, validDays: e.target.value }))}
                placeholder="VD: 30" disabled={bulkSaving} />
            </label>
            <label>Kênh áp dụng
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
          <div className="mt-4 flex items-center gap-2">
            <Button type="submit" loading={bulkSaving}>
              {bulkConfirm ? 'Xác nhận gửi' : 'Tiếp tục'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setBulkOpen(false); setBulkForm(EMPTY_BULK_FORM); setBulkConfirm(false) }}
              disabled={bulkSaving}
            >
              Hủy
            </Button>
          </div>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-sm border border-border bg-surface p-6">
          <h3 className="mb-4">{t('coupons.createTitle')}</h3>
          {formError && <Alert tone="danger" size="sm" className="mb-3">{formError}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            <label>
              {t('coupons.formCode')}
              <Input required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}  />
              {formFieldErrors.code && <p className="field-error">{formFieldErrors.code}</p>}
            </label>
            <label>
              {t('coupons.formName')}
              <Input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}  />
              {formFieldErrors.name && <p className="field-error">{formFieldErrors.name}</p>}
            </label>
            <label>{t('coupons.formDiscountType')}
              <Select value={form.discountType} onValueChange={(val) => setForm((p) => ({ ...p, discountType: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="FIXED">{t('coupons.formFixed')}</SelectItem>
                <SelectItem value="PERCENT">{t('coupons.formPercent')}</SelectItem>
              </SelectContent></Select>
            </label>
            <label>{t('coupons.formValue')} <Input type="number" min="0" required value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}  /></label>
            <label>{t('coupons.formMinOrder')} <Input type="number" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))}  /></label>
            <label>{t('coupons.formMaxUses')} <Input type="number" min="0" value={form.maxUsage} onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))}  /></label>
            <label>{t('coupons.formExpires')} <Input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}  /></label>
            <label>Kênh áp dụng
              <Select value={form.channel} onValueChange={(val) => setForm((p) => ({ ...p, channel: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Tất cả kênh</SelectItem>
                <SelectItem value="ONLINE">Chỉ online</SelectItem>
                <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
              </SelectContent></Select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={formSaving}>{t('coupons.createBtn')}</Button>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(''); setFormFieldErrors({}) }}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}

      {editCoupon && (
        <form onSubmit={handleEdit} className="mb-6 rounded-sm border border-primary bg-surface p-6">
          <h3 className="mb-4">{t('coupons.editTitle', { code: editCoupon.code })}</h3>
          {editError && <Alert tone="danger" size="sm" className="mb-3">{editError}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            <label>{t('coupons.formDiscountType')}
              <Select value={editForm.discountType} onValueChange={(val) => setEditForm((p) => ({ ...p, discountType: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="FIXED">{t('coupons.formFixed')}</SelectItem>
                <SelectItem value="PERCENT">{t('coupons.formPercent')}</SelectItem>
              </SelectContent></Select>
            </label>
            <label>{t('coupons.formValue')} <Input type="number" min="0" required value={editForm.discountValue} onChange={(e) => setEditForm((p) => ({ ...p, discountValue: e.target.value }))}  /></label>
            <label>{t('coupons.formMinOrder')} <Input type="number" min="0" value={editForm.minimumOrderAmount} onChange={(e) => setEditForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))}  /></label>
            <label>{t('coupons.formMaxUses')} <Input type="number" min="0" value={editForm.maxUsage} onChange={(e) => setEditForm((p) => ({ ...p, maxUsage: e.target.value }))}  /></label>
            <label>{t('coupons.formExpires')} <Input type="date" value={editForm.expiresAt} onChange={(e) => setEditForm((p) => ({ ...p, expiresAt: e.target.value }))}  /></label>
            <label>Kênh áp dụng
              <Select value={editForm.channel || 'ALL'} onValueChange={(val) => setEditForm((p) => ({ ...p, channel: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="ALL">Tất cả kênh</SelectItem>
                <SelectItem value="ONLINE">Chỉ online</SelectItem>
                <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
              </SelectContent></Select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={editSaving}>{editSaving ? t('common.saving') : t('coupons.saveBtn')}</Button>
            <Button type="button" variant="outline" onClick={() => setEditCoupon(null)}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>{t('common.search')}
          <Input type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} placeholder={t('coupons.searchPlaceholder')}  />
        </label>
        <label>{t('coupons.filterStatus')}
          <Select value={query.status}
            onValueChange={(val) => updateQuery({ status: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            <SelectItem value="ACTIVE">{t('coupons.statusActive')}</SelectItem>
            <SelectItem value="INACTIVE">{t('coupons.statusInactive')}</SelectItem>
            <SelectItem value="EXPIRED">{t('coupons.statusExpired')}</SelectItem>
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('coupons.error')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('coupons.empty')} description={t('coupons.emptyDesc')} actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('coupons.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && (
            <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
          )}
        </>
      ) : null}
    </section>
  )
}
