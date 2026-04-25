import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createCoupon, fetchCoupons, updateCoupon, updateCouponStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'

const STATUS_TONES = { ACTIVE: 'success', INACTIVE: 'warning', EXPIRED: 'neutral' }
function CouponStatusBadge({ value }) {
  return <span className={`status-badge status-${STATUS_TONES[value] || 'neutral'}`}>{value}</span>
}

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }
const EMPTY_FORM = { code: '', discountType: 'FIXED_AMOUNT', discountValue: '', minimumOrderAmount: '', maxUsage: '', expiresAt: '' }

export function CouponListScreen({ canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [editCoupon, setEditCoupon] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchCoupons(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  async function handleToggleStatus(coupon) {
    const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const r = await updateCouponStatus(coupon.id, newStatus)
      setState((p) => ({ ...p, items: p.items.map((c) => c.id === coupon.id ? r.item : c) }))
    } catch (e) {
      alert(e.message || 'Lỗi cập nhật')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.code.trim()) { setFormError('Mã coupon không được trống'); return }
    setFormSaving(true)
    setFormError('')
    try {
      const payload = { code: form.code, discountType: form.discountType, discountValue: Number(form.discountValue), minimumOrderAmount: Number(form.minimumOrderAmount) }
      if (form.maxUsage) payload.maxUsage = Number(form.maxUsage)
      if (form.expiresAt) payload.expiresAt = form.expiresAt
      await createCoupon(payload)
      setShowForm(false)
      setForm(EMPTY_FORM)
      setQuery((p) => ({ ...p }))
    } catch (e) {
      setFormError(e.message || 'Lỗi tạo coupon')
    } finally {
      setFormSaving(false)
    }
  }

  function openEdit(coupon) {
    setEditCoupon(coupon)
    setEditForm({
      discountType: coupon.discountType || 'FIXED_AMOUNT',
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
        discountValue: Number(editForm.discountValue),
        minimumOrderAmount: Number(editForm.minimumOrderAmount),
      }
      if (editForm.maxUsage) payload.maxUsage = Number(editForm.maxUsage)
      if (editForm.expiresAt) payload.expiresAt = editForm.expiresAt
      const r = await updateCoupon(editCoupon.id, payload)
      setState((p) => ({ ...p, items: p.items.map((c) => c.id === editCoupon.id ? r.item : c) }))
      setEditCoupon(null)
    } catch (e) {
      setEditError(e.message || 'Lỗi cập nhật coupon')
    } finally {
      setEditSaving(false)
    }
  }

  const columns = useMemo(() => [
    { key: 'code', label: 'Mã', render: (c) => <code style={{ fontWeight: 700 }}>{c.code}</code> },
    {
      key: 'discount', label: 'Giảm giá',
      render: (c) => c.discountType === 'PERCENT' ? `${c.discountValue}%` : formatCurrencyVnd(c.discountValue),
    },
    { key: 'minimumOrderAmount', label: 'Đơn tối thiểu', render: (c) => c.minimumOrderAmount ? formatCurrencyVnd(c.minimumOrderAmount) : '—' },
    { key: 'usage', label: 'Đã dùng', render: (c) => `${c.usageCount}${c.maxUsage ? ` / ${c.maxUsage}` : ''}` },
    { key: 'status', label: 'Trạng thái', render: (c) => <CouponStatusBadge value={c.status} /> },
    { key: 'expiresAt', label: 'Hết hạn', render: (c) => formatDateTime(c.expiresAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => openEdit(c)}>Sửa</button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => handleToggleStatus(c)}>
            {c.status === 'ACTIVE' ? 'Tắt' : 'Bật'}
          </button>
        </div>
      ),
    } : null,
  ].filter(Boolean), [canUpdate])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => ({ ...p, ...partial, page: options.resetPage ? 1 : p.page }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Commerce</p>
          <h1>Mã giảm giá</h1>
          <p>Tạo và quản lý coupon khuyến mãi.</p>
        </div>
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Huỷ' : 'Tạo coupon'}
          </button>
        )}
      </header>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Tạo coupon mới</h3>
          {formError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{formError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>Mã coupon <input className="control-input" required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} /></label>
            <label>Loại giảm
              <select className="control-select" value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}>
                <option value="FIXED_AMOUNT">Số tiền cố định</option>
                <option value="PERCENT">Phần trăm</option>
              </select>
            </label>
            <label>Giá trị giảm <input className="control-input" type="number" min="0" required value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} /></label>
            <label>Đơn tối thiểu <input className="control-input" type="number" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))} /></label>
            <label>Số lần dùng tối đa <input className="control-input" type="number" min="0" value={form.maxUsage} onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))} /></label>
            <label>Ngày hết hạn <input className="control-input" type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={formSaving}>{formSaving ? 'Đang tạo...' : 'Tạo coupon'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }}>Huỷ</button>
          </div>
        </form>
      )}

      {editCoupon && (
        <form onSubmit={handleEdit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-primary)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Chỉnh sửa: <code>{editCoupon.code}</code></h3>
          {editError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{editError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>Loại giảm
              <select className="control-select" value={editForm.discountType} onChange={(e) => setEditForm((p) => ({ ...p, discountType: e.target.value }))}>
                <option value="FIXED_AMOUNT">Số tiền cố định</option>
                <option value="PERCENT">Phần trăm</option>
              </select>
            </label>
            <label>Giá trị giảm <input className="control-input" type="number" min="0" required value={editForm.discountValue} onChange={(e) => setEditForm((p) => ({ ...p, discountValue: e.target.value }))} /></label>
            <label>Đơn tối thiểu <input className="control-input" type="number" min="0" value={editForm.minimumOrderAmount} onChange={(e) => setEditForm((p) => ({ ...p, minimumOrderAmount: e.target.value }))} /></label>
            <label>Số lần dùng tối đa <input className="control-input" type="number" min="0" value={editForm.maxUsage} onChange={(e) => setEditForm((p) => ({ ...p, maxUsage: e.target.value }))} /></label>
            <label>Ngày hết hạn <input className="control-input" type="date" value={editForm.expiresAt} onChange={(e) => setEditForm((p) => ({ ...p, expiresAt: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditCoupon(null)}>Huỷ</button>
          </div>
        </form>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>Tìm mã
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })} placeholder="Mã coupon" />
        </label>
        <label>Trạng thái
          <select className="control-select" value={query.status}
            onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải coupon" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi" description={state.error} actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title="Không có coupon" description="Chưa có mã giảm giá nào." actionLabel="Xoá lọc" onAction={() => setQuery(INITIAL_QUERY)} />}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <AdminTable caption="Danh sách coupon" columns={columns} rows={state.items} />
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
