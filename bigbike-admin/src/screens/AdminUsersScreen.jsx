import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAdminUsers, updateAdminUser } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20 }

export function AdminUsersScreen({ canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchAdminUsers(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  function openEdit(user) {
    setEditUser(user)
    setEditForm({ displayName: user.displayName || '', status: user.status || '', newPassword: '' })
    setEditError('')
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const payload = {}
      if (editForm.displayName.trim()) payload.displayName = editForm.displayName.trim()
      if (editForm.status.trim()) payload.status = editForm.status.trim()
      if (editForm.newPassword.trim()) payload.newPassword = editForm.newPassword.trim()
      const r = await updateAdminUser(editUser.id, payload)
      setState((p) => ({ ...p, items: p.items.map((u) => u.id === editUser.id ? r.item : u) }))
      setEditUser(null)
    } catch (e) {
      setEditError(e.message || 'Lỗi cập nhật')
    } finally {
      setEditSaving(false)
    }
  }

  const columns = useMemo(() => [
    { key: 'email', label: 'Email', render: (u) => u.email },
    { key: 'displayName', label: 'Tên', render: (u) => u.displayName },
    { key: 'role', label: 'Role', render: (u) => u.role || '—' },
    { key: 'status', label: 'Trạng thái', render: (u) => <span style={{ color: u.status === 'ACTIVE' ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{u.status}</span> },
    { key: 'lastLoginAt', label: 'Đăng nhập cuối', render: (u) => formatDateTime(u.lastLoginAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (u) => <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => openEdit(u)}>Sửa</button>,
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
          <p className="eyebrow">Admin</p>
          <h1>Admin Users</h1>
          <p>Quản lý tài khoản quản trị viên.</p>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {editUser && (
        <form onSubmit={handleEdit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-primary)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Chỉnh sửa: <strong>{editUser.email}</strong></h3>
          {editError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{editError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>Tên hiển thị <input className="control-input" value={editForm.displayName} onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))} /></label>
            <label>Trạng thái
              <select className="control-select" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </label>
            <label>Mật khẩu mới <input className="control-input" type="password" value={editForm.newPassword} placeholder="Để trống = giữ nguyên" onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Huỷ</button>
          </div>
        </form>
      )}

      <section className="filter-bar">
        <label>Tìm kiếm
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })} placeholder="Email hoặc tên" />
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải admin users" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi" description={state.error} actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title="Không có kết quả" description="Không tìm thấy admin user nào." />}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <AdminTable caption="Danh sách admin users" columns={columns} rows={state.items} />
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
