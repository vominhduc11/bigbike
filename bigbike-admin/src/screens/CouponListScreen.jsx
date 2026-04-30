import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createCoupon, fetchCoupons, updateCoupon, updateCouponStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const STATUS_TONES = { ACTIVE: 'success', INACTIVE: 'warning', EXPIRED: 'neutral', ARCHIVED: 'neutral' }
function CouponStatusBadge({ value }) {
  const { t } = useTranslation()
  const labels = {
    ACTIVE: t('coupons.statusActive'),
    INACTIVE: t('coupons.statusInactive'),
    EXPIRED: t('coupons.statusExpired'),
    ARCHIVED: t('coupons.statusArchived'),
  }
  return <span className={`status-badge status-${STATUS_TONES[value] || 'neutral'}`}>{labels[value] ?? value}</span>
}

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }
const EMPTY_FORM = { code: '', name: '', discountType: 'FIXED', discountValue: '', minimumOrderAmount: '', maxUsage: '', expiresAt: '' }

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
  const [formSaving, setFormSaving] = useState(false)
  const [editCoupon, setEditCoupon] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    fetchCoupons(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  async function handleToggleStatus(coupon) {
    const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setActionError('')
    try {
      const r = await updateCouponStatus(coupon.id, newStatus)
      setState((p) => ({ ...p, items: p.items.map((c) => c.id === coupon.id ? r.item : c) }))
    } catch (e) {
      setActionError(e.message || t('common.error'))
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.code.trim()) { setFormError(t('coupons.formCode') + ' ' + t('common.required').toLowerCase()); return }
    if (!form.name.trim()) { setFormError(t('coupons.formName') + ' ' + t('common.required').toLowerCase()); return }
    setFormSaving(true)
    setFormError('')
    try {
      const payload = {
        code: form.code,
        name: form.name.trim(),
        discountType: form.discountType,
        amount: Number(form.discountValue),
        minimumAmount: Number(form.minimumOrderAmount) || 0,
      }
      if (form.maxUsage) payload.usageLimit = Number(form.maxUsage)
      if (form.expiresAt) payload.expiresAt = toEndOfDayInstant(form.expiresAt)
      await createCoupon(payload)
      setShowForm(false)
      setForm(EMPTY_FORM)
      setQuery((p) => ({ ...p }))
    } catch (e) {
      setFormError(e.message || t('coupons.creating'))
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
    { key: 'code', label: t('coupons.colCode'), render: (c) => <code style={{ fontWeight: 700 }}>{c.code}</code> },
    {
      key: 'discount', label: t('coupons.colDiscount'),
      render: (c) => c.discountType === 'PERCENT' ? `${c.discountValue}%` : formatCurrencyVnd(c.discountValue),
    },
    { key: 'name', label: t('coupons.colName'), render: (c) => c.name || '—' },
    { key: 'minimumOrderAmount', label: t('coupons.colMinOrder'), render: (c) => c.minimumOrderAmount ? formatCurrencyVnd(c.minimumOrderAmount) : '—' },
    { key: 'usage', label: t('coupons.colUsed'), render: (c) => `${c.usageCount}${c.maxUsage ? ` / ${c.maxUsage}` : ''}` },
    { key: 'status', label: t('coupons.colStatus'), render: (c) => <CouponStatusBadge value={c.status} /> },
    { key: 'expiresAt', label: t('coupons.colExpires'), render: (c) => formatDateTime(c.expiresAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => openEdit(c)}>{t('common.edit')}</button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => handleToggleStatus(c)}>
            {c.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
          </button>
        </div>
      ),
    } : null,
  ].filter(Boolean), [canUpdate, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
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
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('coupons.createBtn')}
          </button>
        )}
      </header>

      {actionError && (
        <p className="inline-error">
          {actionError}
          <button type="button" onClick={() => setActionError('')}>✕</button>
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('coupons.createTitle')}</h3>
          {formError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{formError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>{t('coupons.formCode')} <input className="control-input" required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} /></label>
            <label>{t('coupons.formName')} <input className="control-input" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>{t('coupons.formDiscountType')}
              <select className="control-select" value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}>
                <option value="FIXED">{t('coupons.formFixed')}</option>
                <option value="PERCENT">{t('coupons.formPercent')}</option>
              </select>
            </label>
            <label>{t('coupons.formValue')} <input className="control-input" type="number" min="0" required value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} /></label>
            <label>{t('coupons.formMinOrder')} <input className="control-input" type="number" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))} /></label>
            <label>{t('coupons.formMaxUses')} <input className="control-input" type="number" min="0" value={form.maxUsage} onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))} /></label>
            <label>{t('coupons.formExpires')} <input className="control-input" type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={formSaving}>{formSaving ? t('coupons.creating') : t('coupons.createBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {editCoupon && (
        <form onSubmit={handleEdit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-primary)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('coupons.editTitle', { code: editCoupon.code })}</h3>
          {editError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{editError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>{t('coupons.formDiscountType')}
              <select className="control-select" value={editForm.discountType} onChange={(e) => setEditForm((p) => ({ ...p, discountType: e.target.value }))}>
                <option value="FIXED">{t('coupons.formFixed')}</option>
                <option value="PERCENT">{t('coupons.formPercent')}</option>
              </select>
            </label>
            <label>{t('coupons.formValue')} <input className="control-input" type="number" min="0" required value={editForm.discountValue} onChange={(e) => setEditForm((p) => ({ ...p, discountValue: e.target.value }))} /></label>
            <label>{t('coupons.formMinOrder')} <input className="control-input" type="number" min="0" value={editForm.minimumOrderAmount} onChange={(e) => setEditForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))} /></label>
            <label>{t('coupons.formMaxUses')} <input className="control-input" type="number" min="0" value={editForm.maxUsage} onChange={(e) => setEditForm((p) => ({ ...p, maxUsage: e.target.value }))} /></label>
            <label>{t('coupons.formExpires')} <input className="control-input" type="date" value={editForm.expiresAt} onChange={(e) => setEditForm((p) => ({ ...p, expiresAt: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? t('common.saving') : t('coupons.saveBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditCoupon(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>{t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} placeholder={t('coupons.searchPlaceholder')} />
        </label>
        <label>{t('coupons.filterStatus')}
          <select className="control-select" value={query.status}
            onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            <option value="ALL">{t('common.all')}</option>
            <option value="ACTIVE">{t('coupons.statusActive')}</option>
            <option value="INACTIVE">{t('coupons.statusInactive')}</option>
            <option value="EXPIRED">{t('coupons.statusExpired')}</option>
          </select>
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
