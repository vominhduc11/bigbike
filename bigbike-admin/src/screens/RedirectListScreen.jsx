import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createRedirect, deleteRedirect, fetchRedirects, toggleRedirect } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

const EMPTY_FORM = { sourcePattern: '', targetUrl: '', redirectType: '301' }

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20 }

export function RedirectListScreen({ canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchRedirects(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  async function handleToggle(redirect) {
    try {
      const r = await toggleRedirect(redirect.id, !redirect.isEnabled)
      setState((p) => ({ ...p, items: p.items.map((rd) => rd.id === redirect.id ? r.item : rd) }))
    } catch (e) { alert(e.message) }
  }

  async function handleDelete(redirectId) {
    if (!window.confirm('Xoá redirect này?')) return
    try {
      await deleteRedirect(redirectId)
      setState((p) => ({ ...p, items: p.items.filter((rd) => rd.id !== redirectId) }))
    } catch (e) { alert(e.message) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.sourcePattern.trim() || !form.targetUrl.trim()) { setFormError('Vui lòng điền đầy đủ thông tin'); return }
    setFormSaving(true)
    setFormError('')
    try {
      await createRedirect({ ...form, redirectType: Number(form.redirectType) })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setQuery((p) => ({ ...p }))
    } catch (e) {
      setFormError(e.message || 'Lỗi tạo redirect')
    } finally {
      setFormSaving(false)
    }
  }

  const columns = useMemo(() => [
    { key: 'source', label: 'Source', render: (rd) => <code style={{ fontSize: '0.8rem' }}>{rd.sourcePattern}</code> },
    { key: 'target', label: 'Target', render: (rd) => <code style={{ fontSize: '0.8rem' }}>{rd.targetUrl}</code> },
    { key: 'type', label: 'Type', render: (rd) => <span className={`status-badge status-info`}>{rd.redirectType}</span> },
    { key: 'enabled', label: 'Bật', render: (rd) => <span className={`status-badge status-${rd.isEnabled ? 'success' : 'neutral'}`}>{rd.isEnabled ? 'ON' : 'OFF'}</span> },
    { key: 'updatedAt', label: 'Cập nhật', render: (rd) => formatDateTime(rd.updatedAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (rd) => (
        <span style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleToggle(rd)}>
            {rd.isEnabled ? 'Tắt' : 'Bật'}
          </button>
          <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDelete(rd.id)}>
            Xoá
          </button>
        </span>
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
          <p className="eyebrow">SEO</p>
          <h1>URL Redirect</h1>
          <p>Quản lý redirect 301/302 từ URL cũ sang mới.</p>
        </div>
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Huỷ' : 'Thêm redirect'}
          </button>
        )}
      </header>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Redirect mới</h3>
          {formError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{formError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '1rem' }}>
            <label>Source URL <input className="control-input" required value={form.sourcePattern} onChange={(e) => setForm((p) => ({ ...p, sourcePattern: e.target.value }))} placeholder="/old-path" /></label>
            <label>Target URL <input className="control-input" required value={form.targetUrl} onChange={(e) => setForm((p) => ({ ...p, targetUrl: e.target.value }))} placeholder="/new-path" /></label>
            <label>Loại
              <select className="control-select" value={form.redirectType} onChange={(e) => setForm((p) => ({ ...p, redirectType: e.target.value }))}>
                <option value="301">301 Permanent</option>
                <option value="302">302 Temporary</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={formSaving}>{formSaving ? 'Đang tạo...' : 'Tạo'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Huỷ</button>
          </div>
        </form>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>Tìm kiếm
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })}
            placeholder="Source hoặc target URL" />
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải redirect" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi" description={state.error} actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title="Không có redirect" description="Chưa có URL redirect nào." actionLabel="Xoá lọc" onAction={() => setQuery(INITIAL_QUERY)} />}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <AdminTable caption="Danh sách redirect" columns={columns} rows={state.items} />
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
